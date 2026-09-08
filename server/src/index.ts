import express from 'express';
import cors from 'cors';
import multer from 'multer';
import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { prisma } from './lib/prisma.js';
import { normalizeInstagramHandle, instagramUrl } from './lib/handles.js';
import { creatorPassesBrief, scoreCreator } from './lib/score.js';
import { discoverWithSerper } from './lib/discovery.js';
import { extractInstagramHandles } from './lib/importer.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));

const creatorInput = z.object({
  name: z.string().trim().optional().nullable(),
  handle: z.string().min(1),
  country: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  niche: z.string().trim().optional().nullable(),
  followers: z.coerce.number().int().nonnegative().optional().nullable(),
  engagementRate: z.coerce.number().nonnegative().optional().nullable(),
  avgLikes: z.coerce.number().int().nonnegative().optional().nullable(),
  avgReelViews: z.coerce.number().int().nonnegative().optional().nullable(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  lastPostAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const briefSchema = z.object({
  name: z.string().trim().default('Untitled campaign'),
  countries: z.array(z.string()).default([]),
  niches: z.array(z.string()).default([]),
  minFollowers: z.coerce.number().int().nonnegative().optional().nullable(),
  maxFollowers: z.coerce.number().int().nonnegative().optional().nullable(),
  minEngagementRate: z.coerce.number().nonnegative().optional().nullable(),
  minAvgReelViews: z.coerce.number().int().nonnegative().optional().nullable(),
  emailRequired: z.boolean().default(false),
  activeWithinDays: z.coerce.number().int().positive().optional().nullable(),
  targetCount: z.coerce.number().int().positive().max(500).default(100)
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: true, discovery: process.env.SERPER_API_KEY ? 'serper' : 'manual/import' });
  } catch {
    res.status(503).json({ ok: false, database: false });
  }
});

app.get('/api/stats', async (_req, res) => {
  const [total, candidates, approved, voided, exclusions] = await Promise.all([
    prisma.creator.count(),
    prisma.creator.count({ where: { status: 'CANDIDATE' } }),
    prisma.creator.count({ where: { status: 'APPROVED' } }),
    prisma.creator.count({ where: { status: 'VOIDED' } }),
    prisma.exclusion.count()
  ]);
  const scored = await prisma.creator.aggregate({ _avg: { score: true }, where: { status: { not: 'VOIDED' } } });
  res.json({ total, candidates, approved, voided, exclusions, avgScore: scored._avg.score ?? 0 });
});

app.get('/api/creators', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;
  const minFollowers = req.query.minFollowers ? Number(req.query.minFollowers) : undefined;
  const take = Math.min(Number(req.query.take || 250), 500);

  const creators = await prisma.creator.findMany({
    where: {
      ...(status && ['CANDIDATE', 'APPROVED', 'VOIDED'].includes(status) ? { status: status as any } : {}),
      ...(country ? { country } : {}),
      ...(Number.isFinite(minFollowers) ? { followers: { gte: minFollowers } } : {}),
      ...(search ? {
        OR: [
          { handle: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { niche: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      } : {})
    },
    orderBy: [{ score: 'desc' }, { followers: 'desc' }],
    take
  });
  res.json(creators);
});

app.post('/api/creators', async (req, res) => {
  const parsed = creatorInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const handle = normalizeInstagramHandle(parsed.data.handle);
  if (!handle) return res.status(400).json({ error: 'Invalid Instagram username or URL.' });

  const exclusion = await prisma.exclusion.findFirst({ where: { handle } });
  if (exclusion) return res.status(409).json({ error: `@${handle} is blocked by the ${exclusion.type.toLowerCase()} list.`, exclusion });

  const existing = await prisma.creator.findUnique({ where: { handle } });
  if (existing) return res.status(409).json({ error: `@${handle} already exists.`, creator: existing });

  const data = parsed.data;
  const score = scoreCreator({ ...data, lastPostAt: data.lastPostAt || null });
  const creator = await prisma.creator.create({
    data: {
      name: data.name || null,
      handle,
      instagramUrl: instagramUrl(handle),
      country: data.country || null,
      city: data.city || null,
      niche: data.niche || null,
      followers: data.followers ?? null,
      engagementRate: data.engagementRate ?? null,
      avgLikes: data.avgLikes ?? null,
      avgReelViews: data.avgReelViews ?? null,
      email: data.email || null,
      lastPostAt: data.lastPostAt ? new Date(data.lastPostAt) : null,
      notes: data.notes || null,
      score
    }
  });
  res.status(201).json(creator);
});

app.patch('/api/creators/:id', async (req, res) => {
  const current = await prisma.creator.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: 'Creator not found.' });
  const parsed = creatorInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let handle = current.handle;
  if (parsed.data.handle) {
    const normalized = normalizeInstagramHandle(parsed.data.handle);
    if (!normalized) return res.status(400).json({ error: 'Invalid Instagram username.' });
    handle = normalized;
  }
  const merged = { ...current, ...parsed.data, handle };
  const score = scoreCreator(merged);
  const creator = await prisma.creator.update({
    where: { id: current.id },
    data: {
      ...parsed.data,
      handle,
      instagramUrl: instagramUrl(handle),
      email: parsed.data.email === '' ? null : parsed.data.email,
      lastPostAt: parsed.data.lastPostAt ? new Date(parsed.data.lastPostAt) : parsed.data.lastPostAt === null ? null : undefined,
      score
    }
  });
  res.json(creator);
});

app.post('/api/creators/:id/approve', async (req, res) => {
  const creator = await prisma.creator.update({ where: { id: req.params.id }, data: { status: 'APPROVED', voidReason: null } });
  await prisma.exclusion.upsert({
    where: { handle_type: { handle: creator.handle, type: 'USED' } },
    update: {},
    create: { handle: creator.handle, type: 'USED', reason: 'Approved / used creator' }
  });
  res.json(creator);
});

app.post('/api/creators/:id/void', async (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Voided by reviewer';
  const creator = await prisma.creator.update({ where: { id: req.params.id }, data: { status: 'VOIDED', voidReason: reason } });
  await prisma.exclusion.upsert({
    where: { handle_type: { handle: creator.handle, type: 'VOIDED' } },
    update: { reason },
    create: { handle: creator.handle, type: 'VOIDED', reason }
  });
  res.json(creator);
});

app.post('/api/creators/:id/candidate', async (req, res) => {
  const current = await prisma.creator.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: 'Creator not found.' });
  const creator = await prisma.creator.update({ where: { id: req.params.id }, data: { status: 'CANDIDATE', voidReason: null } });
  await prisma.exclusion.deleteMany({ where: { handle: current.handle, type: 'VOIDED' } });
  res.json(creator);
});

app.post('/api/campaigns', async (req, res) => {
  const parsed = briefSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const campaign = await prisma.campaign.create({ data: parsed.data });
  res.status(201).json(campaign);
});

app.get('/api/campaigns', async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  res.json(campaigns);
});

app.post('/api/discovery/search', async (req, res) => {
  const parsed = briefSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const brief = parsed.data;

  // First, rank/filter what is already in the database.
  const existing = await prisma.creator.findMany({ where: { status: { not: 'VOIDED' } }, take: 1000 });
  const existingMatches = existing
    .filter(c => creatorPassesBrief(c, brief))
    .map(c => ({ ...c, score: scoreCreator(c, brief) }))
    .sort((a, b) => b.score - a.score);

  // Optionally discover new public profile URLs via web search. This deliberately does not scrape Instagram.
  const external = await discoverWithSerper(brief);
  const exclusions = new Set((await prisma.exclusion.findMany({ select: { handle: true } })).map(x => x.handle));
  const known = new Set(existing.map(x => x.handle));
  let newlyAdded = 0;

  for (const item of external) {
    if (exclusions.has(item.handle) || known.has(item.handle)) continue;
    await prisma.creator.create({
      data: {
        handle: item.handle,
        instagramUrl: item.instagramUrl,
        name: item.name,
        country: item.country,
        niche: item.niche,
        source: item.source,
        sourceSnippet: item.sourceSnippet,
        score: scoreCreator(item, brief)
      }
    });
    known.add(item.handle);
    newlyAdded++;
  }

  const refreshed = await prisma.creator.findMany({ where: { status: 'CANDIDATE' }, take: 1000 });
  const matches = refreshed
    .filter(c => creatorPassesBrief(c, brief))
    .map(c => ({ ...c, score: scoreCreator(c, brief) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, brief.targetCount);

  // Persist campaign-specific scores so the list sorts naturally after discovery.
  await Promise.all(matches.map(c => prisma.creator.update({ where: { id: c.id }, data: { score: c.score } })));

  res.json({
    provider: process.env.SERPER_API_KEY ? 'serper + database' : 'database only',
    newlyAdded,
    existingMatches: existingMatches.length,
    results: matches,
    note: process.env.SERPER_API_KEY
      ? 'Public profile URLs were discovered through web search. Metrics still require review/import or a dedicated creator-data provider.'
      : 'Add SERPER_API_KEY for public web discovery, or import/manual-add creators. No Instagram scraping is performed.'
  });
});

app.get('/api/exclusions', async (req, res) => {
  const type = typeof req.query.type === 'string' && ['USED', 'VOIDED'].includes(req.query.type) ? req.query.type as any : undefined;
  const exclusions = await prisma.exclusion.findMany({ where: type ? { type } : {}, orderBy: { createdAt: 'desc' }, take: 1000 });
  res.json(exclusions);
});

app.post('/api/exclusions/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach an .xlsx, .csv, .txt, or .md file.' });
  const type = String(req.body.type || '').toUpperCase();
  if (!['USED', 'VOIDED'].includes(type)) return res.status(400).json({ error: 'type must be USED or VOIDED.' });

  const handles = await extractInstagramHandles(req.file.buffer, req.file.originalname);
  let inserted = 0;
  let alreadyKnown = 0;
  for (const handle of handles) {
    const found = await prisma.exclusion.findUnique({ where: { handle_type: { handle, type: type as any } } });
    if (found) { alreadyKnown++; continue; }
    await prisma.exclusion.create({ data: { handle, type: type as any, sourceFile: req.file.originalname } });
    inserted++;
  }
  res.json({ scanned: handles.length, inserted, alreadyKnown, type });
});

app.get('/api/export.xlsx', async (req, res) => {
  const status = typeof req.query.status === 'string' && ['CANDIDATE', 'APPROVED', 'VOIDED'].includes(req.query.status)
    ? req.query.status as any : 'APPROVED';
  const creators = await prisma.creator.findMany({ where: { status }, orderBy: [{ score: 'desc' }, { followers: 'desc' }] });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Influencer Reach';
  const ws = wb.addWorksheet(status === 'APPROVED' ? 'Approved Creators' : 'Creators');
  ws.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Instagram Username', key: 'handle', width: 24 },
    { header: 'Instagram Link', key: 'instagramUrl', width: 38 },
    { header: 'Country', key: 'country', width: 18 },
    { header: 'City', key: 'city', width: 20 },
    { header: 'Niche', key: 'niche', width: 30 },
    { header: 'Followers', key: 'followers', width: 14 },
    { header: 'Engagement %', key: 'engagementRate', width: 15 },
    { header: 'Avg Likes', key: 'avgLikes', width: 14 },
    { header: 'Avg Reel Views', key: 'avgReelViews', width: 17 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Notes', key: 'notes', width: 36 }
  ];
  ws.addRows(creators);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: 'N1' };
  creators.forEach((creator, i) => {
    ws.getCell(i + 2, 3).value = { text: creator.instagramUrl, hyperlink: creator.instagramUrl };
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="influencer-reach-${String(status).toLowerCase()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.code === 'P2002') return res.status(409).json({ error: 'That Instagram handle already exists.' });
  res.status(500).json({ error: err?.message || 'Unexpected server error.' });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(port, () => {
  console.log(`Influencer Reach listening on :${port}`);
});
