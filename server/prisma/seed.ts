// Seeds a small, clearly-labelled set of films and SAMPLE interpretations for local development.
// Film metadata here is plain factual data (title/year/director) typed in by hand, not copied from a provider.
// Sample content is written by the project, is prefixed "[SAMPLE]", and must never be presented as community activity.
import 'dotenv/config';
import { createPrismaClient } from '../src/repo/prisma.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const db = createPrismaClient(url);

const SAMPLE_AUTHOR_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const author = await db.user.upsert({
    where: { id: SAMPLE_AUTHOR_ID },
    update: {},
    create: {
      id: SAMPLE_AUTHOR_ID,
      username: 'sample_author',
      displayName: 'Sample content (not a real user)',
    },
  });

  const films = [
    { key: 'seed-metropolis-1927', title: 'Metropolis', releaseYear: 1927, director: 'Fritz Lang' },
    { key: 'seed-nosferatu-1922', title: 'Nosferatu', releaseYear: 1922, director: 'F. W. Murnau' },
    {
      key: 'seed-caligari-1920',
      title: 'The Cabinet of Dr. Caligari',
      releaseYear: 1920,
      director: 'Robert Wiene',
    },
  ];
  const filmIds: Record<string, string> = {};
  for (const f of films) {
    const row = await db.film.upsert({
      where: { provider_providerFilmId: { provider: 'seed', providerFilmId: f.key } },
      update: {},
      create: {
        provider: 'seed',
        providerFilmId: f.key,
        title: f.title,
        releaseYear: f.releaseYear,
        director: f.director,
        metadataAttribution: 'Seed data entered by hand for development',
      },
    });
    filmIds[f.key] = row.id;
  }

  const hasSamples = await db.interpretation.count({ where: { authorId: author.id } });
  if (hasSamples > 0) {
    console.log('Sample interpretations already present; skipping.');
    return;
  }

  const metropolis = await db.interpretation.create({
    data: {
      filmId: filmIds['seed-metropolis-1927']!,
      authorId: author.id,
      title: '[SAMPLE] The machine as a devouring idol',
      claim:
        '[SAMPLE] The film presents industrial machinery as something that consumes workers, closer to a sacrificial altar than a neutral tool.',
      interpretationType: 'interpretation',
      spoilerLevel: 'minor',
      evidence: {
        create: [
          {
            evidenceType: 'observation',
            sceneDescription:
              'The sequence where the machine is imagined as a figure that receives workers.',
            description:
              '[SAMPLE] Workers are shown filing toward the machine in a rigid procession, which visually echoes a ritual offering.',
          },
        ],
      },
      tags: {
        create: [
          {
            tag: {
              connectOrCreate: {
                where: { name: 'industrial imagery' },
                create: { name: 'industrial imagery', category: 'motif' },
              },
            },
          },
        ],
      },
      counterReadings: {
        create: [
          {
            authorId: author.id,
            body: '[SAMPLE] A different reading: the sequence dramatises one character’s fear and exhaustion rather than making a claim about machinery itself.',
            evidence: {
              create: [
                {
                  evidenceType: 'observation',
                  description:
                    '[SAMPLE] The scene is framed as the character’s subjective experience, which may limit how far it can be read as the film’s own thesis.',
                },
              ],
            },
          },
        ],
      },
    },
  });

  await db.interpretation.create({
    data: {
      filmId: filmIds['seed-nosferatu-1922']!,
      authorId: author.id,
      title: '[SAMPLE] Sunrise as the story’s moral mechanism',
      claim:
        '[SAMPLE] The ending treats light and time as the decisive force, not the characters’ strength.',
      interpretationType: 'interpretation',
      spoilerLevel: 'major', // demonstrates gated display; contents are hidden until deliberately revealed
      evidence: {
        create: [
          {
            evidenceType: 'observation',
            description:
              '[SAMPLE] The final confrontation is resolved by the arrival of morning rather than a physical struggle.',
          },
        ],
      },
    },
  });

  console.log('Seeded films and sample interpretations', { sampleInterpretation: metropolis.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
