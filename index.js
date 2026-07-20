import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SHEET_CSV = "https://docs.google.com/spreadsheets/d/1JhSODtviGHzXru6Eb5MhfXfVIF5vtJk3pclzzv7j2l4/export?format=csv&gid=1277715587";

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(current); current = ""; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

async function fetchServices() {
  const res = await fetch(SHEET_CSV);
  const text = await res.text();
  const lines = text.trim().split("\n");
  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = (cols[i] || "").trim());
    return row;
  });
}

const server = new Server(
  { name: "meadow-vet-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search-services",
      description: "Search Meadow Vet Care services by species, category, keyword, or price range. All params are optional — omit to return all services.",
      inputSchema: {
        type: "object",
        properties: {
          species: {
            type: "string",
            description: "Filter by species: Dog, Cat, Rabbit, Bird, Small mammal",
          },
          category: {
            type: "string",
            description: "Filter by category: Consultation, Dental, Surgery, Emergency, Diagnostics, Grooming, Behaviour, Vaccination, Preventive, Nutrition, Microchip & ID, End-of-life",
          },
          keyword: {
            type: "string",
            description: "Search in service name and description",
          },
          max_price_cents: {
            type: "number",
            description: "Maximum price in euro cents (e.g., 5500 for €55)",
          },
          available_only: {
            type: "boolean",
            description: "Only show services with available slots this week",
          },
          has_offer: {
            type: "boolean",
            description: "Only show services with a current special offer",
          },
          limit: {
            type: "number",
            description: "Max results to return (default 50)",
          },
        },
      },
    },
    {
      name: "get-summary",
      description: "Get a summary overview of Meadow Vet Care: total services, categories, species served, and current offers.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get-available-slots",
      description: "Find services that currently have available appointment slots this week.",
      inputSchema: {
        type: "object",
        properties: {
          species: {
            type: "string",
            description: "Filter by species (optional)",
          },
          category: {
            type: "string",
            description: "Filter by category (optional)",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const services = await fetchServices();

    switch (name) {
      case "search-services": {
        let filtered = [...services];

        if (args?.species) {
          const sp = args.species.toLowerCase();
          filtered = filtered.filter(s => s.species.toLowerCase() === sp);
        }
        if (args?.category) {
          const cat = args.category.toLowerCase();
          filtered = filtered.filter(s => s.category.toLowerCase() === cat);
        }
        if (args?.keyword) {
          const kw = args.keyword.toLowerCase();
          filtered = filtered.filter(s =>
            s.service_name.toLowerCase().includes(kw) ||
            s.description.toLowerCase().includes(kw)
          );
        }
        if (args?.max_price_cents) {
          filtered = filtered.filter(s => parseFloat(s.price_eur) <= args.max_price_cents);
        }
        if (args?.available_only) {
          filtered = filtered.filter(s => parseInt(s.slots_this_week) > 0);
        }
        if (args?.has_offer) {
          filtered = filtered.filter(s => s.special_offer && s.special_offer.length > 0);
        }

        const limit = args?.limit || 50;
        filtered = filtered.slice(0, limit);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ count: filtered.length, services: filtered }, null, 2),
          }],
        };
      }

      case "get-summary": {
        const categories = [...new Set(services.map(s => s.category))].sort();
        const species = [...new Set(services.map(s => s.species))].sort();
        const offers = services.filter(s => s.special_offer && s.special_offer.length > 0);
        const available = services.filter(s => parseInt(s.slots_this_week) > 0);
        const totalSlots = services.reduce((sum, s) => sum + parseInt(s.slots_this_week || 0), 0);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_services: services.length,
              categories,
              species,
              services_with_offers: offers.length,
              services_available_this_week: available.length,
              total_slots_this_week: totalSlots,
              current_offers: offers.map(s => ({
                service: s.service_name,
                species: s.species,
                offer: s.special_offer,
              })),
            }, null, 2),
          }],
        };
      }

      case "get-available-slots": {
        let filtered = services.filter(s => parseInt(s.slots_this_week) > 0);

        if (args?.species) {
          const sp = args.species.toLowerCase();
          filtered = filtered.filter(s => s.species.toLowerCase() === sp);
        }
        if (args?.category) {
          const cat = args.category.toLowerCase();
          filtered = filtered.filter(s => s.category.toLowerCase() === cat);
        }

        const total = filtered.reduce((sum, s) => sum + parseInt(s.slots_this_week), 0);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_slots: total,
              services_with_slots: filtered.length,
              services: filtered.map(s => ({
                id: s.service_id,
                name: s.service_name,
                species: s.species,
                category: s.category,
                slots: parseInt(s.slots_this_week),
                price_cents: parseFloat(s.price_eur),
                duration_min: parseInt(s.duration_min),
                offer: s.special_offer || null,
              })),
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
