import biAnalystData from "./fixtures/bi-analyst__data-analyst.json";
import biAnalystFrontend from "./fixtures/bi-analyst__frontend.json";
import biAnalystJunior from "./fixtures/bi-analyst__junior-dev.json";
import csGradData from "./fixtures/cs-grad__data-analyst.json";
import csGradFrontend from "./fixtures/cs-grad__frontend.json";
import csGradJunior from "./fixtures/cs-grad__junior-dev.json";
import retailData from "./fixtures/retail-changer__data-analyst.json";
import retailFrontend from "./fixtures/retail-changer__frontend.json";
import retailJunior from "./fixtures/retail-changer__junior-dev.json";
import {
  DEMO_PERSONAS,
  DEMO_POSTINGS,
  DemoFixture,
  type DemoFixture as Fixture,
} from "./schema";

const FILES = [
  biAnalystData,
  biAnalystFrontend,
  biAnalystJunior,
  csGradData,
  csGradFrontend,
  csGradJunior,
  retailData,
  retailFrontend,
  retailJunior,
];

let catalog: Fixture[] | null = null;

/** Same nine fixtures as `loadDemoCatalog`, bundled for a deferred client import. */
export function loadClientCatalog(): Fixture[] {
  if (catalog) return catalog;
  const fixtures = FILES.map((file) => DemoFixture.parse(file));
  catalog = fixtures.sort((a, b) => {
    const persona = DEMO_PERSONAS.indexOf(a.persona) - DEMO_PERSONAS.indexOf(b.persona);
    if (persona !== 0) return persona;
    return DEMO_POSTINGS.indexOf(a.posting) - DEMO_POSTINGS.indexOf(b.posting);
  });
  return catalog;
}
