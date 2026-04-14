CREATE OR REPLACE FUNCTION artist_listener_percentile(
    user_uuid UUID,
    artist TEXT,
    since_days INT DEFAULT 30
)
RETURNS TABLE (
    percentile NUMERIC,
    user_play_count INT,
    listener_count INT,
    artist_play_count INT
) AS $$
BEGIN
    RETURN QUERY
    WITH per_user AS (
        SELECT user_id, COUNT(*)::INT AS plays
        FROM listening_activity
        WHERE artist_name = artist
          AND played_at >= NOW() - (since_days::TEXT || ' days')::INTERVAL
        GROUP BY user_id
    ),
    user_row AS (
        SELECT plays FROM per_user WHERE user_id = user_uuid
    ),
    stats AS (
        SELECT COUNT(*)::INT AS listener_count, COALESCE(SUM(plays), 0)::INT AS artist_play_count
        FROM per_user
    ),
    ranked AS (
        SELECT plays, PERCENT_RANK() OVER (ORDER BY plays) AS pr
        FROM per_user
    )
    SELECT
        (SELECT pr FROM ranked WHERE plays = (SELECT plays FROM user_row) ORDER BY pr DESC LIMIT 1) AS percentile,
        (SELECT plays FROM user_row) AS user_play_count,
        (SELECT listener_count FROM stats) AS listener_count,
        (SELECT artist_play_count FROM stats) AS artist_play_count;
END;
$$ LANGUAGE plpgsql STABLE;
