-- First, let's ensure we have proper database functions for point management

-- Update the deduct_game_points function to be more robust
CREATE OR REPLACE FUNCTION public.deduct_game_points(p_user_id uuid, p_game_id uuid, p_bet_amount integer, p_transaction_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return false
    RAISE;
END;
$function$;

-- Update the reward_game_points function to handle wins, draws, and losses properly
CREATE OR REPLACE FUNCTION public.reward_game_points(p_user_id uuid, p_game_id uuid, p_reward_amount integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  transaction_desc TEXT;
BEGIN
  -- Determine transaction description based on reward amount
  -- If reward amount equals bet amount, it's a refund (draw)
  -- If reward amount is double bet amount, it's a win
  SELECT CASE 
    WHEN p_reward_amount = (SELECT ABS(amount) FROM transactions WHERE user_id = p_user_id AND game_id = p_game_id AND amount < 0 ORDER BY created_at DESC LIMIT 1) THEN 'Game draw refund'
    WHEN p_reward_amount = 2 * (SELECT ABS(amount) FROM transactions WHERE user_id = p_user_id AND game_id = p_game_id AND amount < 0 ORDER BY created_at DESC LIMIT 1) THEN 'Game win reward'
    ELSE 'Game reward'
  END INTO transaction_desc;
  
  -- Add points to profile
  UPDATE profiles 
  SET points_balance = points_balance + p_reward_amount,
      total_games_played = total_games_played + 1,
      total_games_won = CASE 
        WHEN transaction_desc = 'Game win reward' THEN total_games_won + 1 
        ELSE total_games_won 
      END,
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
    CASE 
      WHEN transaction_desc = 'Game win reward' THEN 'game_win'
      WHEN transaction_desc = 'Game draw refund' THEN 'game_draw'
      ELSE 'game_reward'
    END,
    transaction_desc
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return false
    RAISE;
END;
$function$;

-- Create a function to handle game losses (update stats without points)
CREATE OR REPLACE FUNCTION public.handle_game_loss(p_user_id uuid, p_game_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update game statistics for losing player
  UPDATE profiles 
  SET total_games_played = total_games_played + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$function$;