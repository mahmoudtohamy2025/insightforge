/**
 * Curated, ready-to-import consumer-segment templates.
 *
 * MENA templates are intentionally over-represented — when imported, the engine's
 * shared MENA-aware prompt builder (_shared/prompts.ts) automatically applies the
 * dialect/Halal/family-influence cultural layer, so these double as a showcase of
 * the wedge. All values are realistic profile data, not placeholders.
 */

export interface SegmentTemplate {
  id: string;
  name: string;
  description: string;
  category: "MENA" | "Global";
  demographics: Record<string, string>;
  psychographics: Record<string, string>;
  behavioral_data: Record<string, string>;
  cultural_context: Record<string, string>;
}

export const SEGMENT_TEMPLATES: SegmentTemplate[] = [
  // ───────────────── MENA ─────────────────
  {
    id: "ksa-genz-women",
    name: "Saudi Gen-Z Women",
    description: "Digitally-native young Saudi women balancing tradition with global trends.",
    category: "MENA",
    demographics: { age_range: "18-26", gender: "Female", location: "Riyadh, Saudi Arabia", income_level: "Upper middle", education: "College educated", occupation: "Student / early-career" },
    psychographics: { values: "Family, faith, ambition, self-expression", lifestyle: "Social-media-first, café and mall culture", interests: "Fashion, beauty, entrepreneurship, travel", attitudes: "Aspirational, brand-aware, authenticity-seeking" },
    behavioral_data: { purchase_behavior: "Mobile-first; swayed by Snapchat/Instagram creators", media_consumption: "Snapchat, TikTok, Instagram, YouTube", brand_preferences: "Global beauty + modest-fashion labels", decision_factors: "Peer reviews, modesty fit, fast shipping" },
    cultural_context: { region: "Saudi Arabia (GCC)", language: "Arabic (Najdi) / English", norms: "Modesty, family approval, gender-considerate spaces", religious: "Practicing Muslim; Halal-conscious" },
  },
  {
    id: "gulf-affluent-expats",
    name: "Gulf Affluent Expats",
    description: "High-earning Western/Asian expatriates in the UAE, remittance- and convenience-driven.",
    category: "MENA",
    demographics: { age_range: "30-45", gender: "Mixed", location: "Dubai, UAE", income_level: "High income", education: "Postgraduate", occupation: "Finance / tech / professional services" },
    psychographics: { values: "Career growth, lifestyle, financial security", lifestyle: "Cosmopolitan, brunch culture, frequent travel", interests: "Dining, fitness, real estate, investing", attitudes: "Quality-over-price, time-poor, premium-seeking" },
    behavioral_data: { purchase_behavior: "Subscription-heavy, app-based, loyalty-program members", media_consumption: "LinkedIn, Instagram, podcasts, Netflix", brand_preferences: "International premium brands", decision_factors: "Convenience, status, reviews, delivery speed" },
    cultural_context: { region: "UAE (GCC)", language: "English / Arabic", norms: "Multicultural, status-conscious", nationality: "Expatriate" },
  },
  {
    id: "egypt-budget-families",
    name: "Egyptian Budget-Conscious Families",
    description: "Cost-sensitive urban Egyptian households stretching a middle-income budget.",
    category: "MENA",
    demographics: { age_range: "30-50", gender: "Mixed", location: "Cairo, Egypt", income_level: "Lower middle", education: "Some college", occupation: "Public sector / small business" },
    psychographics: { values: "Family welfare, thrift, community, faith", lifestyle: "Extended-family households, value shopping", interests: "Family outings, football, religious media", attitudes: "Price-first, skeptical of new brands, loyal once trusted" },
    behavioral_data: { purchase_behavior: "Cash and installments; bulk and promotion-driven", media_consumption: "Facebook, YouTube, satellite TV", brand_preferences: "Local and regional value brands", decision_factors: "Price, durability, family recommendation" },
    cultural_context: { region: "Egypt (North Africa)", language: "Arabic (Egyptian)", norms: "Family-centric, elder influence, bargaining culture", religious: "Muslim majority; Halal-conscious" },
  },
  {
    id: "uae-tech-early-adopters",
    name: "UAE Tech Early-Adopters",
    description: "Young Gulf professionals who buy the newest gadgets and apps first.",
    category: "MENA",
    demographics: { age_range: "24-35", gender: "Mixed", location: "Abu Dhabi, UAE", income_level: "Upper middle", education: "College educated", occupation: "Engineering / startup / creative" },
    psychographics: { values: "Innovation, status, efficiency", lifestyle: "Always-online, gadget-driven, gaming", interests: "Tech, crypto, gaming, smart home", attitudes: "Novelty-seeking, willing to pay for the latest" },
    behavioral_data: { purchase_behavior: "Pre-orders, early access, app-store-led", media_consumption: "X/Twitter, YouTube, Reddit, Discord", brand_preferences: "Apple, Samsung, emerging tech brands", decision_factors: "Specs, hype, ecosystem, reviews" },
    cultural_context: { region: "UAE (GCC)", language: "English / Arabic", norms: "Status-aware, globally connected", religious: "Mixed; many Halal-conscious" },
  },
  {
    id: "khaleeji-affluent-women",
    name: "Khaleeji Affluent Women",
    description: "High-net-worth Gulf national women; luxury, modest-fashion and family-driven.",
    category: "MENA",
    demographics: { age_range: "28-45", gender: "Female", location: "Kuwait / Qatar", income_level: "High income", education: "College educated", occupation: "Homemaker / business owner" },
    psychographics: { values: "Family standing, faith, refinement", lifestyle: "Private gatherings, luxury retail, travel", interests: "Luxury fashion, perfumery (oud), interiors", attitudes: "Brand-loyal, quality-obsessed, discreet" },
    behavioral_data: { purchase_behavior: "Boutique + personal-shopper; high basket size", media_consumption: "Instagram, Snapchat, WhatsApp groups", brand_preferences: "Luxury houses + premium modest fashion", decision_factors: "Exclusivity, modesty fit, family/peer taste" },
    cultural_context: { region: "GCC (Khaleeji)", language: "Arabic (Gulf)", norms: "Modesty, family honor, women-only spaces, wasta", religious: "Practicing Muslim; Halal-strict" },
  },
  {
    id: "ramadan-shoppers",
    name: "Ramadan Seasonal Shoppers",
    description: "MENA households whose spending spikes around Ramadan and Eid (best paired with Ramadan mode).",
    category: "MENA",
    demographics: { age_range: "25-50", gender: "Mixed", location: "Jeddah / Cairo / Amman", income_level: "Middle income", education: "College educated", occupation: "Mixed" },
    psychographics: { values: "Faith, generosity, family gathering", lifestyle: "Night-shifted routine during Ramadan; festive Eid prep", interests: "Cooking, charity, gifting, gatherings", attitudes: "Deal-seeking but generous; tradition-led" },
    behavioral_data: { purchase_behavior: "Grocery + gifting surge after Iftar; late-night online", media_consumption: "TV series (musalsalat), YouTube, Instagram", brand_preferences: "Food, sweets, apparel, electronics on offer", decision_factors: "Ramadan promotions, family size, charity tie-ins" },
    cultural_context: { region: "MENA", language: "Arabic", norms: "Iftar/Suhoor rhythm, Zakat, Eid gifting", religious: "Observant Muslim; fasting" },
  },
  // ───────────────── Global ─────────────────
  {
    id: "us-millennials",
    name: "US Urban Millennials",
    description: "Value-and-experience-driven American city dwellers, 28-40.",
    category: "Global",
    demographics: { age_range: "28-40", gender: "Mixed", location: "United States (urban)", income_level: "Middle income", education: "College educated", occupation: "Knowledge worker" },
    psychographics: { values: "Authenticity, sustainability, work-life balance", lifestyle: "Urban, experience-over-ownership, subscription-native", interests: "Travel, wellness, streaming, side hustles", attitudes: "Brand-skeptical, review-driven, convenience-led" },
    behavioral_data: { purchase_behavior: "App + subscription; DTC and marketplace", media_consumption: "Instagram, TikTok, podcasts, YouTube", brand_preferences: "DTC and purpose-driven brands", decision_factors: "Reviews, values alignment, price, convenience" },
    cultural_context: { region: "North America", language: "English", norms: "Individualist, brand-values-aware" },
  },
  {
    id: "eu-eco-conscious",
    name: "European Eco-Conscious Consumers",
    description: "Sustainability-first Western European shoppers who pay a green premium.",
    category: "Global",
    demographics: { age_range: "30-50", gender: "Mixed", location: "Germany / Netherlands", income_level: "Upper middle", education: "Postgraduate", occupation: "Professional" },
    psychographics: { values: "Sustainability, quality, privacy", lifestyle: "Minimalist, cycling, local-first", interests: "Climate, design, organic food, travel", attitudes: "Skeptical of greenwashing; willing to pay for proof" },
    behavioral_data: { purchase_behavior: "Researches provenance; fewer, higher-quality buys", media_consumption: "Newsletters, YouTube, podcasts", brand_preferences: "Certified-sustainable and local brands", decision_factors: "Eco-certification, durability, repairability" },
    cultural_context: { region: "Western Europe", language: "English / German", norms: "Privacy-conscious, environmentally driven" },
  },
  {
    id: "sea-mobile-first",
    name: "Southeast-Asian Mobile-First Youth",
    description: "Price-sensitive, super-app-native young consumers across SEA.",
    category: "Global",
    demographics: { age_range: "18-30", gender: "Mixed", location: "Jakarta / Manila", income_level: "Lower middle", education: "Some college", occupation: "Student / gig worker" },
    psychographics: { values: "Community, aspiration, value-for-money", lifestyle: "Super-app-driven, social commerce, gaming", interests: "Live-shopping, mobile games, K-content", attitudes: "Deal-hunting, influencer-led, brand-curious" },
    behavioral_data: { purchase_behavior: "Live-commerce, e-wallets, COD; flash sales", media_consumption: "TikTok, Shopee/Lazada Live, YouTube, Facebook", brand_preferences: "Affordable local + regional brands", decision_factors: "Price, vouchers, influencer trust, shipping" },
    cultural_context: { region: "Southeast Asia", language: "Bahasa / English / Tagalog", norms: "Community-driven, mobile-native" },
  },
];
