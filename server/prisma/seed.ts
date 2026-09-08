import { PrismaClient } from '@prisma/client';
import { scoreCreator } from '../src/lib/score.js';

const prisma = new PrismaClient();

const creators = [
  { name: 'Avery Lane', handle: 'averylane.style', country: 'United States', city: 'New York', niche: 'Fashion / Outfits', followers: 184000, engagementRate: 4.8, avgLikes: 9100, avgReelViews: 142000, email: 'avery@example.com' },
  { name: 'Mia Hart', handle: 'miahartlooks', country: 'United Kingdom', city: 'London', niche: 'Fashion / Beauty', followers: 92000, engagementRate: 5.6, avgLikes: 5100, avgReelViews: 88000, email: 'mia@example.com' },
  { name: 'Jade Rowan', handle: 'jaderowan', country: 'United Kingdom', city: 'Manchester', niche: 'Street Style', followers: 265000, engagementRate: 3.9, avgLikes: 10300, avgReelViews: 192000, email: 'jade@example.com' },
  { name: 'Nora Fields', handle: 'norafieldsfits', country: 'United States', city: 'Los Angeles', niche: 'Lifestyle / Fashion', followers: 61000, engagementRate: 6.2, avgLikes: 4200, avgReelViews: 73000, email: null }
];

for (const item of creators) {
  await prisma.creator.upsert({
    where: { handle: item.handle },
    update: {},
    create: { ...item, instagramUrl: `https://www.instagram.com/${item.handle}/`, score: scoreCreator(item), source: 'demo-seed' }
  });
}

console.log('Seeded demo creators.');
await prisma.$disconnect();
