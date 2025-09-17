import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Circle, Trophy, Coins, Clock } from 'lucide-react'
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
  playerNumber?: number
  opponentName?: string
}

export function TicTacToe({ gameId, betAmount, onGameEnd, playerNumber = 1, opponentName }: TicTacToeProps) {
  const { profile, refreshProfile } = useAuth()
  const [board, setBoard] = useState<Board>(Array(9).fill(null))
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X')
  const [status, setStatus] = useState<GameStatus>('active')
  const [winner, setWinner] = useState<Player>(null)
  const [timeLeft, setTimeLeft] = useState(30) // 30 seconds per turn
  const [gameStarted, setGameStarted] = useState(false)
  const playerSymbol = playerNumber === 1 ? 'X' : 'O'
  const [gameData, setGameData] = useState<any>(null)

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

  // Timer effect
  useEffect(() => {
    if (!gameStarted || winner || currentPlayer !== playerSymbol) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - opponent wins
          const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X'
          setWinner(opponentSymbol)
          setStatus('completed')
          onGameEnd?.(opponentSymbol)
          handleGameCompletion(opponentSymbol)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gameStarted, winner, currentPlayer, playerSymbol])

  // Reset timer when turn changes
  useEffect(() => {
    if (gameStarted && !winner) {
      setTimeLeft(30)
    }
  }, [currentPlayer, gameStarted])

  // Listen for real-time game updates
  useEffect(() => {
    if (!gameId) return

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new
          if (updatedGame.game_data) {
            const data = updatedGame.game_data as any
            if (data.board) {
              setBoard(data.board)
              setCurrentPlayer(data.currentPlayer || 'X')
              setGameStarted(true)
              
              const gameWinner = checkWinner(data.board)
              if (gameWinner) {
                setWinner(gameWinner)
                setStatus('completed')
                onGameEnd?.(gameWinner)
              }
            }
          }
          
          if (updatedGame.status === 'active' && !gameStarted) {
            setGameStarted(true)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, gameStarted])

  // Initialize game data
  useEffect(() => {
    const initializeGame = async () => {
      try {
        const { data: game, error } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()

        if (error) throw error

        if (game.game_data && game.game_data.board) {
          const data = game.game_data as any
          setBoard(data.board)
          setCurrentPlayer(data.currentPlayer || 'X')
        }

        if (game.status === 'active') {
          setGameStarted(true)
        }

        setGameData(game)
      } catch (error) {
        console.error('Error initializing game:', error)
      }
    }

    initializeGame()
  }, [gameId])

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
        
        toast.success(`You won ${betAmount * 2} points!`, {
          icon: <Trophy className="h-4 w-4" />,
        })
      } else if (gameWinner === 'draw') {
        // Draw - refund the bet amount to both players
        const { error: refundError } = await supabase.rpc('reward_game_points', {
          p_user_id: profile.user_id,
          p_game_id: gameId,
          p_reward_amount: betAmount
        })
        if (refundError) throw refundError
        
        toast.info('Draw! Your bet has been refunded.', {
          icon: <Coins className="h-4 w-4" />,
        })
      } else {
        // Player lost - no reward, just update stats
        const { error: statsError } = await supabase
          .from('profiles')
          .update({ 
            total_games_played: profile.total_games_played + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', profile.user_id)
        
        if (statsError) throw statsError
        
        toast.error(`You lost ${betAmount} points.`)
      }

      // Refresh profile to show updated balance
      await refreshProfile()
      
    } catch (error: any) {
      console.error('Error completing game:', error)
      toast.error('Failed to complete game: ' + error.message)
    }
  }

  const handleCellClick = async (index: number) => {
    if (board[index] || winner || currentPlayer !== playerSymbol) {
      return
    }

    const newBoard = [...board]
    newBoard[index] = currentPlayer
    setBoard(newBoard)

    const nextPlayer = currentPlayer === 'X' ? 'O' : 'X'
    setCurrentPlayer(nextPlayer)

    // Update game data in database
    try {
      const { error } = await supabase
        .from('games')
        .update({
          game_data: {
            board: newBoard,
            currentPlayer: nextPlayer,
            lastMove: { player: currentPlayer, position: index, timestamp: new Date().toISOString() }
          }
        })
        .eq('id', gameId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating game:', error)
      toast.error('Failed to update game')
      return
    }

    const gameWinner = checkWinner(newBoard)
    if (gameWinner) {
      setWinner(gameWinner)
      setStatus('completed')
      onGameEnd?.(gameWinner)
      handleGameCompletion(gameWinner)
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
    if (!gameStarted) return 'Waiting for game to start...'
    return currentPlayer === playerSymbol ? 'Your turn' : "Opponent's turn"
  }

  const getStatusColor = () => {
    if (winner === 'draw') return 'secondary'
    if (winner === playerSymbol) return 'default'
    if (winner) return 'destructive'
    if (!gameStarted) return 'secondary'
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
          {gameStarted && !winner && (
            <Badge variant={currentPlayer === playerSymbol ? 'default' : 'secondary'} className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeLeft}s
            </Badge>
          )}
          {opponentName && (
            <Badge variant="outline" className="text-xs">
              vs {opponentName}
            </Badge>
          )}
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
          {opponentName && (
            <span className="block mt-1">
              Playing against: <span className="font-semibold">{opponentName}</span>
            </span>
          )}
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
              onClick={() => {
                setCurrentGame(null)
                window.location.reload()
              }} 
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