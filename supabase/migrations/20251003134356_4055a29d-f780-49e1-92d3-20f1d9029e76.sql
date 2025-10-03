-- Add ticket_numbers to game_participants to track multiple tickets per user
ALTER TABLE game_participants 
ADD COLUMN ticket_numbers integer[] DEFAULT ARRAY[]::integer[];

-- Add comment for clarity
COMMENT ON COLUMN game_participants.ticket_numbers IS 'Array of ticket numbers purchased by this participant';