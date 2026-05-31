// Server-side content resolution seam (PRD §8/§12). A game registers a resolver that turns the
// host's config (category, rating selections) into the concrete, rating-filtered Content the plugin
// receives in init(). The client NEVER supplies content — startGame calls the resolver server-side.
// Engine declares the seam; games install resolvers at bootstrap (no @features import in engine).

// Structural rating filter — the content feature's RatingFilter satisfies this shape.
export interface ResolveRatingFilter {
  tiers: string[];
  excludeTags: string[];
}

export interface ResolveInput {
  config: unknown; // the validated game config
  ratingFilter: ResolveRatingFilter;
  seed: string;
}

export type ContentResolver = (input: ResolveInput) => Promise<unknown>;

const resolvers = new Map<string, ContentResolver>();

export const registerContentResolver = (gameId: string, resolver: ContentResolver): void => {
  resolvers.set(gameId, resolver);
};

export const getContentResolver = (gameId: string): ContentResolver | undefined => resolvers.get(gameId);
