-- Migration 007: Create Recommendation Engine Tables
-- Purpose: Support smart recommendations with TF-IDF vectors and user interactions

-- =====================================================
-- 1. USER INTERACTIONS TABLE
-- =====================================================
-- Tracks all user interactions with media for collaborative filtering
CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('book', 'audio', 'video')),
    media_id UUID NOT NULL,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('view', 'like', 'share', 'complete', 'progress')),
    interaction_value DECIMAL(5,2) DEFAULT 1.0, -- Weighted value: view=1, like=2, share=3, complete=5
    duration_seconds INTEGER DEFAULT 0, -- Time spent on media
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    metadata JSONB, -- Additional context: device, location, time_of_day, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast querying
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_media ON user_interactions(media_type, media_id);
CREATE INDEX idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX idx_user_interactions_created_at ON user_interactions(created_at DESC);
CREATE INDEX idx_user_interactions_user_media ON user_interactions(user_id, media_type, media_id);

-- =====================================================
-- 2. MEDIA VECTORS TABLE
-- =====================================================
-- Stores precomputed TF-IDF vectors for content-based filtering
CREATE TABLE IF NOT EXISTS media_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('book', 'audio', 'video')),
    media_id UUID NOT NULL,
    vector_data JSONB NOT NULL, -- Normalized TF-IDF vector as JSON object {term: weight, ...}
    vector_magnitude DECIMAL(10,6) NOT NULL DEFAULT 1.0, -- For cosine similarity optimization
    feature_text TEXT, -- Concatenated text used for vectorization (for debugging/reindexing)
    language media_language, -- Language of the content
    genres TEXT[], -- Array of genres/categories
    tags TEXT[], -- Array of tags for quick filtering
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_type, media_id)
);

-- Indexes for efficient similarity search
CREATE INDEX idx_media_vectors_media_type ON media_vectors(media_type);
CREATE INDEX idx_media_vectors_language ON media_vectors(language);
CREATE INDEX idx_media_vectors_genres ON media_vectors USING GIN(genres);
CREATE INDEX idx_media_vectors_tags ON media_vectors USING GIN(tags);
CREATE INDEX idx_media_vectors_updated ON media_vectors(last_updated DESC);

-- =====================================================
-- 3. RECOMMENDATION CACHE TABLE
-- =====================================================
-- Caches computed recommendations to reduce computation
CREATE TABLE IF NOT EXISTS recommendation_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(255) NOT NULL UNIQUE, -- e.g., "content_based:media_id:123:limit:10"
    recommendation_type VARCHAR(50) NOT NULL, -- content_based, personalized, hybrid
    user_id UUID, -- NULL for content-based only
    media_id UUID, -- NULL for personalized only
    recommendations JSONB NOT NULL, -- Array of recommendation objects
    score_threshold DECIMAL(5,4), -- Minimum score used
    ttl_seconds INTEGER DEFAULT 3600, -- Time-to-live in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for cache lookup and cleanup
CREATE INDEX idx_recommendation_cache_key ON recommendation_cache(cache_key);
CREATE INDEX idx_recommendation_cache_user_id ON recommendation_cache(user_id);
CREATE INDEX idx_recommendation_cache_expires_at ON recommendation_cache(expires_at);
CREATE INDEX idx_recommendation_cache_type ON recommendation_cache(recommendation_type);

-- =====================================================
-- 4. USER PREFERENCE PROFILES TABLE
-- =====================================================
-- Stores aggregated user preferences for fast personalization
CREATE TABLE IF NOT EXISTS user_preference_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preference_vector JSONB NOT NULL, -- Aggregated TF-IDF vector from user's history
    favorite_genres TEXT[], -- Most interacted genres
    favorite_languages media_language[], -- Preferred languages
    interaction_count INTEGER DEFAULT 0, -- Total interactions
    avg_completion_rate DECIMAL(5,2) DEFAULT 0, -- Average completion percentage
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user profile lookup
CREATE INDEX idx_user_profiles_user_id ON user_preference_profiles(user_id);
CREATE INDEX idx_user_profiles_updated ON user_preference_profiles(last_updated DESC);

-- =====================================================
-- 5. SIMILAR ITEMS CACHE TABLE
-- =====================================================
-- Precomputed nearest neighbors for each media item
CREATE TABLE IF NOT EXISTS similar_items_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_type VARCHAR(20) NOT NULL,
    media_id UUID NOT NULL,
    similar_media_type VARCHAR(20) NOT NULL,
    similar_media_id UUID NOT NULL,
    similarity_score DECIMAL(6,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    ranking INTEGER NOT NULL, -- 1 = most similar, 2 = second most similar, etc.
    algorithm VARCHAR(50) DEFAULT 'cosine_tfidf', -- Algorithm used
    last_computed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_type, media_id, similar_media_type, similar_media_id)
);

-- Indexes for fast similar item lookup
CREATE INDEX idx_similar_items_media ON similar_items_cache(media_type, media_id, ranking);
CREATE INDEX idx_similar_items_score ON similar_items_cache(similarity_score DESC);
CREATE INDEX idx_similar_items_computed ON similar_items_cache(last_computed DESC);

-- =====================================================
-- 6. RECOMMENDATION METRICS TABLE
-- =====================================================
-- Tracks recommendation performance for A/B testing and monitoring
CREATE TABLE IF NOT EXISTS recommendation_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_id UUID NOT NULL, -- Links to shown recommendations
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id UUID NOT NULL,
    media_type VARCHAR(20) NOT NULL,
    recommendation_type VARCHAR(50) NOT NULL, -- content_based, personalized, hybrid
    position INTEGER NOT NULL, -- Position in recommendation list (1-indexed)
    score DECIMAL(6,4) NOT NULL, -- Recommendation score
    was_clicked BOOLEAN DEFAULT FALSE,
    was_completed BOOLEAN DEFAULT FALSE,
    time_to_click_seconds INTEGER, -- Time between show and click
    shown_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    clicked_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for metrics analysis
CREATE INDEX idx_recommendation_metrics_user ON recommendation_metrics(user_id);
CREATE INDEX idx_recommendation_metrics_media ON recommendation_metrics(media_type, media_id);
CREATE INDEX idx_recommendation_metrics_type ON recommendation_metrics(recommendation_type);
CREATE INDEX idx_recommendation_metrics_shown_at ON recommendation_metrics(shown_at DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at on user_interactions
CREATE TRIGGER update_user_interactions_updated_at
    BEFORE UPDATE ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-expire cache entries (cleanup trigger)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM recommendation_cache WHERE expires_at < CURRENT_TIMESTAMP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_expired_cache
    AFTER INSERT ON recommendation_cache
    EXECUTE FUNCTION cleanup_expired_cache();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate cosine similarity between two JSONB vectors
CREATE OR REPLACE FUNCTION cosine_similarity(vector1 JSONB, vector2 JSONB)
RETURNS DECIMAL AS $$
DECLARE
    dot_product DECIMAL := 0;
    magnitude1 DECIMAL := 0;
    magnitude2 DECIMAL := 0;
    key TEXT;
    val1 DECIMAL;
    val2 DECIMAL;
BEGIN
    -- Calculate dot product and magnitudes
    FOR key IN SELECT jsonb_object_keys(vector1)
    LOOP
        val1 := (vector1->key)::TEXT::DECIMAL;
        magnitude1 := magnitude1 + (val1 * val1);

        IF vector2 ? key THEN
            val2 := (vector2->key)::TEXT::DECIMAL;
            dot_product := dot_product + (val1 * val2);
        END IF;
    END LOOP;

    FOR key IN SELECT jsonb_object_keys(vector2)
    LOOP
        val2 := (vector2->key)::TEXT::DECIMAL;
        magnitude2 := magnitude2 + (val2 * val2);
    END LOOP;

    -- Avoid division by zero
    IF magnitude1 = 0 OR magnitude2 = 0 THEN
        RETURN 0;
    END IF;

    RETURN dot_product / (SQRT(magnitude1) * SQRT(magnitude2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE user_interactions IS 'Tracks all user interactions with media for recommendation engine';
COMMENT ON TABLE media_vectors IS 'Stores precomputed TF-IDF vectors for content-based recommendations';
COMMENT ON TABLE recommendation_cache IS 'Caches computed recommendations to reduce computation overhead';
COMMENT ON TABLE user_preference_profiles IS 'Aggregated user preferences for fast personalized recommendations';
COMMENT ON TABLE similar_items_cache IS 'Precomputed nearest neighbors for each media item';
COMMENT ON TABLE recommendation_metrics IS 'Tracks recommendation performance for monitoring and optimization';

COMMENT ON COLUMN user_interactions.interaction_value IS 'Weighted value: view=1.0, like=2.0, share=3.0, complete=5.0';
COMMENT ON COLUMN media_vectors.vector_data IS 'Normalized TF-IDF vector as JSON object';
COMMENT ON COLUMN recommendation_cache.ttl_seconds IS 'Time-to-live: 3600s (1h) default, 300s (5m) for real-time';
