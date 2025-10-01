-- Enable realtime for the games table
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;

-- Ensure games table has full replica identity for realtime updates
ALTER TABLE public.games REPLICA IDENTITY FULL;