-- Create function to handle point deduction when joining/creating games
CREATE OR REPLACE FUNCTION deduct_game_points(
  p_user_id UUID,
  p_game_id UUID, 
  p_bet_amount INTEGER,
  p_transaction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance with row lock to prevent race conditions
  SELECT points_balance INTO current_balance
  FROM profiles 
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has sufficient balance
  IF current_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;
  
  -- Deduct points from profile
  UPDATE profiles 
  SET points_balance = points_balance - p_bet_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    game_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    p_game_id,
    -p_bet_amount,
    p_transaction_type,
    CASE 
      WHEN p_transaction_type = 'game_bet' THEN 'Bet placed for game'
      WHEN p_transaction_type = 'game_join' THEN 'Joined game'
      ELSE 'Game transaction'
    END
  );
  
  RETURN TRUE;
END;
$$;

-- Create function to handle point rewards when winning games
CREATE OR REPLACE FUNCTION reward_game_points(
  p_user_id UUID,
  p_game_id UUID,
  p_reward_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add points to profile
  UPDATE profiles 
  SET points_balance = points_balance + p_reward_amount,
      total_games_won = total_games_won + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    game_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    p_user_id,
    p_game_id,
    p_reward_amount,
    'game_win',
    'Game win reward'
  );
  
  -- Update total games played for the user
  UPDATE profiles 
  SET total_games_played = total_games_played + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;