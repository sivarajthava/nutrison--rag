import { NextResponse } from "next/server";

export const revalidate = 3600; // Cache corpus registry for 1 hour

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/documents`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("BFF /api/documents error:", error);
    // Fallback static registry for high availability during build/offline
    return NextResponse.json(
      [
        {
          document_id: "cold-food-storage",
          title: "Cold Food Storage Chart",
          publisher: "U.S. Food and Drug Administration / FoodSafety.gov",
          year: 2021,
          category: "food_safety",
          source_url: "https://www.foodsafety.gov/keep-food-safe/cold-food-storage-chart",
          description: "Refrigerator and freezer storage duration limits for meats, poultry, seafood, eggs, and leftovers at 40°F (4°C) or below.",
        },
        {
          document_id: "who-healthy-diet",
          title: "Healthy Diet Fact Sheet N°394",
          publisher: "World Health Organization (WHO)",
          year: 2020,
          category: "nutrition",
          source_url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
          description: "Core global principles of healthy diets for adults and infants, addressing fat limits, sugar, salt, fruits, and vegetables.",
        },
        {
          document_id: "fao-who-healthy-diets",
          title: "Sustainable Healthy Diets: Guiding Principles",
          publisher: "Food and Agriculture Organization (FAO) & World Health Organization (WHO)",
          year: 2019,
          category: "nutrition",
          source_url: "https://www.fao.org/documents/card/en/c/ca6640en/",
          description: "Guiding principles combining nutritional adequacy and environmental sustainability in dietary habits.",
        },
        {
          document_id: "who-five-keys",
          title: "Five Keys to Safer Food Manual",
          publisher: "World Health Organization (WHO)",
          year: 2006,
          category: "food_safety",
          source_url: "https://www.who.int/publications/i/item/9789241594639",
          description: "Core food hygiene manual: Keep clean, separate raw and cooked, cook thoroughly, keep food at safe temperatures, use safe water and raw materials.",
        },
        {
          document_id: "eatwell-guide",
          title: "The Eatwell Guide: Helping you eat a healthy, balanced diet",
          publisher: "Public Health England / NHS / UK Food Standards Agency",
          year: 2018,
          category: "nutrition",
          source_url: "https://www.gov.uk/government/publications/the-eatwell-guide",
          description: "UK national food guide outlining dietary proportions across five main food groups, hydration, and nutritional labeling.",
        },
        {
          document_id: "fsa-chill",
          title: "Chilling Food Correctly",
          publisher: "UK Food Standards Agency (FSA)",
          year: 2020,
          category: "food_safety",
          source_url: "https://www.food.gov.uk/safety-hygiene/chilling",
          description: "Guidance on refrigerator temperatures (below 5°C), chilling cooked food, freezing, and safe defrosting.",
        },
        {
          document_id: "kitchen-companion",
          title: "Kitchen Companion: Your Safe Food Handbook",
          publisher: "USDA Food Safety and Inspection Service (FSIS)",
          year: 2008,
          category: "food_safety",
          source_url: "https://www.fsis.usda.gov/shared/data/Kitchen_Companion.pdf",
          description: "Comprehensive consumer safe food handling handbook covering bacteria, shopping, cooking internal temperatures, and leftovers.",
        },
      ],
      { status: 200 }
    );
  }
}
