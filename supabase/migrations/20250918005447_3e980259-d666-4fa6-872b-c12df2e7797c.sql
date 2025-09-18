-- Update the transaction_type constraint to include all needed values
ALTER TABLE transactions 
DROP CONSTRAINT transactions_transaction_type_check;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_transaction_type_check 
CHECK (transaction_type = ANY (ARRAY[
  'game_win'::text, 
  'game_loss'::text, 
  'game_draw'::text,
  'game_bet'::text,
  'game_join'::text,
  'game_reward'::text,
  'signup_bonus'::text, 
  'admin_adjustment'::text
]));