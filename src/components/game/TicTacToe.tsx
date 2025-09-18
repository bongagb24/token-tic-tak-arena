import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Circle, Trophy, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'

type Player = 'X' | 'O' | 'draw' | null
type Board = Player[]
type GameStatus = 'waiting' | 'active' | 'completed'

interface TicTacToeProps {
  gameId: string
  betAmount: number
  onGameEnd?: (winner: Player) => void
  isPlayerOne?: boolean
}

export function TicTacToe({ gameId, betAmount, onGameEnd, isPlayerOne = true }: TicTacToeProps) {
  const { profile, refreshProfile } = useAuth()
  const [board, setBoard] = useState<Board>(Array(9).fill(null))
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X')
  const [status, setStatus] = useState<GameStatus>('active')
  const [winner, setWinner] = useState<Player>(null)
  const playerSymbol = isPlayerOne ? 'X' : 'O'

  const winningPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ]

  const checkWinner = (board: Board): Player => {
    for (const pattern of winningPatterns) {
      const [a, b, c] = pattern
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]
      }
    }
    if (board.every(cell => cell !== null)) {
      return 'draw' as Player
    }
    return null
  }

  const handleGameCompletion = async (gameWinner: Player) => {
    if (!profile) return
    
    try {
      // Update game status to completed
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          winner_id: gameWinner === playerSymbol ? profile.user_id : null
        })
        .eq('id', gameId)
      
      if (gameError) throw gameError

      // Handle rewards based on game outcome
      if (gameWinner === playerSymbol) {
        // Player won - reward double the bet amount
        const { error: rewardError } = await supabase.rpc('reward_game_points', {
          p_user_id: profile.user_id,
          p_game_id: gameId,
          p_reward_amount: betAmount * 2
        })
        if (rewardError) throw rewardError
        
        toast.success(`🎉 Victory! You won ${betAmount * 2} points!`, {
          icon: <Trophy className="h-4 w-4" />,
        })
      } else if (gameWinner === 'draw') {
        // Draw - refund the bet amount
        const { error: refundError } = await supabase.rpc('reward_game_points', {
          p_user_id: profile.user_id,
          p_game_id: gameId,
          p_reward_amount: betAmount
        })
        if (refundError) throw refundError
        
        toast.info(`🤝 Draw! Your ${betAmount} points have been refunded.`, {
          icon: <Coins className="h-4 w-4" />,
        })
      } else {
        // Player lost - use loss handler function
        const { error: lossError } = await supabase.rpc('handle_game_loss', {
          p_user_id: profile.user_id,
          p_game_id: gameId
        })
        if (lossError) throw lossError
        
        toast.error(`💔 Defeat! You lost ${betAmount} points.`)
      }

      // Refresh profile to show updated balance and stats
      await refreshProfile()
      
    } catch (error: any) {
      console.error('Error completing game:', error)
      toast.error('Failed to complete game: ' + error.message)
    }
  }

  const handleCellClick = (index: number) => {
    if (board[index] || winner || currentPlayer !== playerSymbol) {
      return
    }

    const newBoard = [...board]
    newBoard[index] = currentPlayer
    setBoard(newBoard)

    const gameWinner = checkWinner(newBoard)
    if (gameWinner) {
      setWinner(gameWinner)
      setStatus('completed')
      onGameEnd?.(gameWinner)
      handleGameCompletion(gameWinner)
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
    }
  }

  const renderCell = (index: number) => {
    const value = board[index]
    return (
      <button
        key={index}
        onClick={() => handleCellClick(index)}
        disabled={!!value || !!winner || currentPlayer !== playerSymbol}
        className="aspect-square bg-secondary/50 border border-border rounded-lg flex items-center justify-center text-4xl font-bold transition-all hover:bg-secondary disabled:cursor-not-allowed group"
      >
        {value === 'X' && (
          <X className="h-8 w-8 text-primary animate-in zoom-in-75 duration-300" />
        )}
        {value === 'O' && (
          <Circle className="h-8 w-8 text-accent animate-in zoom-in-75 duration-300" />
        )}
        {!value && !winner && currentPlayer === playerSymbol && (
          <div className="opacity-0 group-hover:opacity-30 transition-opacity">
            {playerSymbol === 'X' ? (
              <X className="h-8 w-8 text-primary" />
            ) : (
              <Circle className="h-8 w-8 text-accent" />
            )}
          </div>
        )}
      </button>
    )
  }

  const getStatusMessage = () => {
    if (winner === 'draw') return "It's a draw!"
    if (winner) return winner === playerSymbol ? 'You won!' : 'You lost!'
    return currentPlayer === playerSymbol ? 'Your turn' : "Opponent's turn"
  }

  const getStatusColor = () => {
    if (winner === 'draw') return 'secondary'
    if (winner === playerSymbol) return 'default'
    if (winner) return 'destructive'
    return currentPlayer === playerSymbol ? 'default' : 'secondary'
  }

  return (
    <Card variant="neon" className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5" />
          Tic-Tac-Toe Arena
        </CardTitle>
        <div className="flex items-center justify-center gap-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Coins className="h-3 w-3" />
            {betAmount} pts
          </Badge>
          <Badge variant={getStatusColor()}>
            {getStatusMessage()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {Array(9).fill(null).map((_, index) => renderCell(index))}
        </div>
        
        <div className="text-center text-sm text-muted-foreground">
          You are playing as{' '}
          <span className="font-bold">
            {playerSymbol === 'X' ? (
              <span className="text-primary">X</span>
            ) : (
              <span className="text-accent">O</span>
            )}
          </span>
        </div>
        
        {winner && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {winner === 'draw' 
                ? 'Game ended in a draw' 
                : `Player ${winner} wins!`
              }
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              size="sm"
              className="w-full"
            >
              Play Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}