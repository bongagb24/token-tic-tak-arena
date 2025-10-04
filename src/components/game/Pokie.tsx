import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Coins, Trophy, Zap, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface PokieProps {
  gameId: string
  betAmount: number
  onGameEnd: () => void
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '7️⃣', '🔔']
const GRID_SIZE = 4

interface Cell {
  symbol: string
  isSpinning: boolean
  finalSymbol: string
}

export function Pokie({ gameId, betAmount, onGameEnd }: PokieProps) {
  const { profile, refreshProfile } = useAuth()
  const [grid, setGrid] = useState<Cell[][]>([])
  const [spinning, setSpinning] = useState(false)
  const [winAmount, setWinAmount] = useState<number | null>(null)
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null)

  useEffect(() => {
    initializeGrid()
  }, [])

  const initializeGrid = () => {
    const newGrid: Cell[][] = []
    for (let i = 0; i < GRID_SIZE; i++) {
      const row: Cell[] = []
      for (let j = 0; j < GRID_SIZE; j++) {
        row.push({
          symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          isSpinning: false,
          finalSymbol: ''
        })
      }
      newGrid.push(row)
    }
    setGrid(newGrid)
  }

  const spin = async () => {
    if (spinning || !profile) return

    setSpinning(true)
    setWinAmount(null)
    setGameResult(null)

    // Start spinning animation
    const spinningGrid = grid.map(row =>
      row.map(cell => ({
        ...cell,
        isSpinning: true
      }))
    )
    setGrid(spinningGrid)

    // Generate final symbols
    const finalGrid: Cell[][] = []
    for (let i = 0; i < GRID_SIZE; i++) {
      const row: Cell[] = []
      for (let j = 0; j < GRID_SIZE; j++) {
        const finalSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
        row.push({
          symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          isSpinning: true,
          finalSymbol
        })
      }
      finalGrid.push(row)
    }

    // Stop spinning with stagger effect
    for (let col = 0; col < GRID_SIZE; col++) {
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setGrid(prevGrid => {
        const newGrid = prevGrid.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            if (colIdx === col) {
              return {
                ...cell,
                symbol: finalGrid[rowIdx][colIdx].finalSymbol,
                isSpinning: false
              }
            }
            return cell
          })
        )
        return newGrid
      })
    }

    // Check for wins
    setTimeout(() => {
      checkWins(finalGrid)
    }, 500)
  }

  const checkWins = async (finalGrid: Cell[][]) => {
    const wins: string[] = []
    const multipliers: { [key: string]: number } = {
      '🍒': 2,
      '🍋': 2,
      '🍊': 3,
      '🍇': 3,
      '💎': 5,
      '⭐': 7,
      '7️⃣': 10,
      '🔔': 15
    }

    // Check rows
    for (let i = 0; i < GRID_SIZE; i++) {
      const row = finalGrid[i]
      const firstSymbol = row[0].finalSymbol
      if (row.every(cell => cell.finalSymbol === firstSymbol)) {
        wins.push(`Row ${i + 1}`)
      }
    }

    // Check columns
    for (let j = 0; j < GRID_SIZE; j++) {
      const firstSymbol = finalGrid[0][j].finalSymbol
      let allMatch = true
      for (let i = 1; i < GRID_SIZE; i++) {
        if (finalGrid[i][j].finalSymbol !== firstSymbol) {
          allMatch = false
          break
        }
      }
      if (allMatch) {
        wins.push(`Column ${j + 1}`)
      }
    }

    // Check diagonals
    const topLeftSymbol = finalGrid[0][0].finalSymbol
    let diagonal1Match = true
    for (let i = 1; i < GRID_SIZE; i++) {
      if (finalGrid[i][i].finalSymbol !== topLeftSymbol) {
        diagonal1Match = false
        break
      }
    }
    if (diagonal1Match) wins.push('Diagonal ↘')

    const topRightSymbol = finalGrid[0][GRID_SIZE - 1].finalSymbol
    let diagonal2Match = true
    for (let i = 1; i < GRID_SIZE; i++) {
      if (finalGrid[i][GRID_SIZE - 1 - i].finalSymbol !== topRightSymbol) {
        diagonal2Match = false
        break
      }
    }
    if (diagonal2Match) wins.push('Diagonal ↙')

    // Calculate winnings
    if (wins.length > 0) {
      // Get the most common symbol for multiplier
      const symbolCounts: { [key: string]: number } = {}
      finalGrid.forEach(row => {
        row.forEach(cell => {
          symbolCounts[cell.finalSymbol] = (symbolCounts[cell.finalSymbol] || 0) + 1
        })
      })
      
      const mostCommonSymbol = Object.keys(symbolCounts).reduce((a, b) =>
        symbolCounts[a] > symbolCounts[b] ? a : b
      )
      
      const baseMultiplier = multipliers[mostCommonSymbol] || 2
      const totalMultiplier = baseMultiplier * wins.length
      const winnings = betAmount * totalMultiplier

      setWinAmount(winnings)
      setGameResult('win')

      try {
        // Reward player
        await supabase.rpc('reward_game_points', {
          p_user_id: profile!.user_id,
          p_game_id: gameId,
          p_reward_amount: winnings
        })

        // Update game
        await supabase
          .from('games')
          .update({
            status: 'completed',
            winner_id: profile!.user_id,
            completed_at: new Date().toISOString(),
            game_data: {
              wins: wins,
              winAmount: winnings,
              grid: finalGrid.map(row => row.map(cell => cell.finalSymbol))
            }
          })
          .eq('id', gameId)

        await refreshProfile()
        toast.success(`🎉 You won ${winnings} points! (${wins.join(', ')})`, {
          duration: 5000
        })
      } catch (error) {
        console.error('Error processing win:', error)
      }
    } else {
      setGameResult('lose')
      
      try {
        // Mark game as completed
        await supabase.rpc('handle_game_loss', {
          p_user_id: profile!.user_id,
          p_game_id: gameId
        })

        await supabase
          .from('games')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            game_data: {
              grid: finalGrid.map(row => row.map(cell => cell.finalSymbol))
            }
          })
          .eq('id', gameId)

        await refreshProfile()
        toast.error('Better luck next time!')
      } catch (error) {
        console.error('Error processing loss:', error)
      }
    }

    setSpinning(false)
    
    // Auto close after result
    setTimeout(() => {
      onGameEnd()
    }, 4000)
  }

  return (
    <Card variant="neon" className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-gaming-gold" />
              Pokie Machine
            </CardTitle>
            <CardDescription>
              Match 4 symbols in a row, column, or diagonal to win!
            </CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Coins className="h-4 w-4" />
            Bet: {betAmount} pts
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Grid */}
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-6 rounded-lg">
          <div className="grid grid-cols-4 gap-3">
            {grid.map((row, rowIdx) =>
              row.map((cell, colIdx) => (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className={`
                    aspect-square bg-background rounded-lg 
                    flex items-center justify-center text-4xl
                    border-2 border-primary/20
                    transition-all duration-300
                    ${cell.isSpinning ? 'animate-spin' : ''}
                    ${gameResult === 'win' ? 'scale-105 border-gaming-gold shadow-lg shadow-gaming-gold/50' : ''}
                  `}
                >
                  {cell.isSpinning ? (
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="animate-scale-in">{cell.symbol}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Result */}
        {gameResult && (
          <div className={`
            text-center p-4 rounded-lg animate-fade-in
            ${gameResult === 'win' 
              ? 'bg-gaming-gold/10 border-2 border-gaming-gold' 
              : 'bg-destructive/10 border-2 border-destructive/50'
            }
          `}>
            {gameResult === 'win' ? (
              <>
                <Trophy className="h-12 w-12 mx-auto mb-2 text-gaming-gold animate-bounce" />
                <p className="text-2xl font-bold text-gaming-gold">
                  🎉 WINNER! 🎉
                </p>
                <p className="text-xl font-semibold mt-2">
                  You won {winAmount} points!
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-muted-foreground">
                  No matches this time
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try again!
                </p>
              </>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="space-y-4">
          <Button
            onClick={spin}
            disabled={spinning || gameResult !== null}
            size="lg"
            className="w-full text-lg"
          >
            {spinning ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Spinning...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Spin ({betAmount} pts)
              </>
            )}
          </Button>

          {/* Paytable */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm font-semibold mb-2">Multipliers:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>🍒 🍋 = 2x</div>
              <div>🍊 🍇 = 3x</div>
              <div>💎 = 5x</div>
              <div>⭐ = 7x</div>
              <div>7️⃣ = 10x</div>
              <div>🔔 = 15x</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Multiple lines multiply your win!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
