import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Users, Clock, Coins, Zap, Trophy } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { TicTacToe } from './TicTacToe'
import { Lottery } from './Lottery'

interface Game {
  id: string
  bet_amount: number
  status: string
  created_at: string
  game_type: string
  game_data?: any
  game_participants: Array<{
    user_id: string
    player_number: number
    profiles: {
      username: string
      vip_level: number
    }
  }>
}

export function GameLobby() {
  const { profile, refreshProfile } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [betAmount, setBetAmount] = useState(100)
  const [currentGame, setCurrentGame] = useState<string | null>(null)
  const [gameType, setGameType] = useState<'tictactoe' | 'lottery'>('tictactoe')
  const [minPlayers, setMinPlayers] = useState(3)

  useEffect(() => {
    fetchGames()
    const interval = setInterval(fetchGames, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Subscribe to new lottery games for notifications
    const channel = supabase
      .channel('lobby-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
          filter: 'game_type=eq.lottery'
        },
        (payload) => {
          const newGame = payload.new as any
          toast.info(`🎰 New lottery available! Ticket: ${newGame.bet_amount} pts`, {
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => fetchGames()
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          id,
          bet_amount,
          status,
          created_at,
          game_type,
          game_data,
          game_participants (
            user_id,
            player_number
          )
        `)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Fetch profiles separately for each game
      const gamesWithProfiles = await Promise.all(
        (data || []).map(async (game) => {
          const participantsWithProfiles = await Promise.all(
            game.game_participants.map(async (participant) => {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('username, vip_level')
                .eq('user_id', participant.user_id)
                .single()
              
              return {
                ...participant,
                profiles: profileData || { username: 'Unknown', vip_level: 0 }
              }
            })
          )
          
          return {
            ...game,
            game_participants: participantsWithProfiles
          }
        })
      )
      
      setGames(gamesWithProfiles)
    } catch (error) {
      console.error('Error fetching games:', error)
    }
  }

  const createGame = async () => {
    if (!profile || profile.points_balance < betAmount) {
      toast.error('Insufficient points!')
      return
    }

    setLoading(true)
    try {
      // Create game with expiration time for lottery
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString() // 20 minutes from now
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          bet_amount: betAmount,
          status: 'waiting',
          game_type: gameType,
          game_data: gameType === 'lottery' ? { minPlayers, expiresAt } : {}
        })
        .select()
        .single()

      if (gameError) throw gameError

      // Deduct points using database function
      const { error: pointsError } = await supabase.rpc('deduct_game_points', {
        p_user_id: profile.user_id,
        p_game_id: game.id,
        p_bet_amount: betAmount,
        p_transaction_type: 'game_bet'
      })

      if (pointsError) throw pointsError

      // Join the game as player 1
      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          game_id: game.id,
          user_id: profile.user_id,
          player_number: 1
        })

      if (participantError) throw participantError

      // Refresh profile to show updated balance
      await refreshProfile()

      const message = gameType === 'lottery' 
        ? 'Lottery created! Waiting for players...' 
        : 'Game created! Waiting for opponent...'
      toast.success(message)
      setCurrentGame(game.id)
      fetchGames()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const joinGame = async (gameId: string, gameBetAmount: number, gameType: string, currentParticipants: number) => {
    if (!profile || profile.points_balance < gameBetAmount) {
      toast.error('Insufficient points!')
      return
    }

    setLoading(true)
    try {
      // Deduct points using database function
      const { error: pointsError } = await supabase.rpc('deduct_game_points', {
        p_user_id: profile.user_id,
        p_game_id: gameId,
        p_bet_amount: gameBetAmount,
        p_transaction_type: 'game_join'
      })

      if (pointsError) throw pointsError

      // Join the game
      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          game_id: gameId,
          user_id: profile.user_id,
          player_number: gameType === 'lottery' ? currentParticipants + 1 : 2
        })

      if (participantError) throw participantError

      // For Tic-Tac-Toe, update status to active when 2 players join
      if (gameType === 'tictactoe') {
        const { error: gameError } = await supabase
          .from('games')
          .update({ status: 'active' })
          .eq('id', gameId)

        if (gameError) throw gameError
      }

      // Refresh profile to show updated balance
      await refreshProfile()

      const message = gameType === 'lottery' 
        ? 'Ticket purchased! Good luck!' 
        : 'Joined game! Let the battle begin!'
      toast.success(message)
      setCurrentGame(gameId)
      fetchGames()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getVipBadge = (level: number) => {
    if (level === 0) return null
    const colors = ['', 'default', 'secondary', 'outline']
    return (
      <Badge variant={colors[level] as any} className="text-xs">
        VIP {level}
      </Badge>
    )
  }

  if (currentGame) {
    const game = games.find(g => g.id === currentGame)
    const isLottery = game?.game_type === 'lottery'

    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => setCurrentGame(null)}
          className="mb-4"
        >
          ← Back to Lobby
        </Button>
        {isLottery ? (
          <Lottery
            gameId={currentGame}
            ticketPrice={betAmount}
            minPlayers={game?.game_data?.minPlayers || 3}
            onGameEnd={() => {
              setTimeout(() => {
                setCurrentGame(null)
                fetchGames()
              }, 3000)
            }}
          />
        ) : (
          <TicTacToe 
            gameId={currentGame} 
            betAmount={betAmount}
            onGameEnd={() => {
              setTimeout(() => {
                setCurrentGame(null)
                fetchGames()
              }, 3000)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card variant="neon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Create New Game
          </CardTitle>
          <CardDescription>
            Choose your game type and set your stake
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Game Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={gameType === 'tictactoe' ? 'default' : 'outline'}
                onClick={() => setGameType('tictactoe')}
                className="w-full"
              >
                Tic-Tac-Toe
              </Button>
              <Button
                variant={gameType === 'lottery' ? 'default' : 'outline'}
                onClick={() => setGameType('lottery')}
                className="w-full"
              >
                🎰 Lottery
              </Button>
            </div>
          </div>

          {gameType === 'lottery' && (
            <div className="space-y-2">
              <Label htmlFor="minPlayers">Minimum Players</Label>
              <Input
                id="minPlayers"
                type="number"
                value={minPlayers}
                onChange={(e) => setMinPlayers(Number(e.target.value))}
                min="2"
                max="20"
              />
              <p className="text-sm text-muted-foreground">
                Draw happens when this many players join
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bet">
              {gameType === 'lottery' ? 'Ticket Price (Points)' : 'Bet Amount (Points)'}
            </Label>
            <Input
              id="bet"
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min="10"
              max={profile?.points_balance || 0}
              step="10"
            />
            <p className="text-sm text-muted-foreground">
              Your balance: {profile?.points_balance || 0} points
            </p>
          </div>
          <Button 
            onClick={createGame} 
            disabled={loading || !profile || betAmount > (profile?.points_balance || 0)}
            className="w-full"
          >
            {loading ? 'Creating...' : `Create ${gameType === 'lottery' ? 'Lottery' : 'Game'}`}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card variant="neon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Available Games
          </CardTitle>
          <CardDescription>
            Join an existing game or wait for your opponent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {games.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active games. Create one to start playing!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((game) => {
                const isLottery = game.game_type === 'lottery'
                const minPlayers = game.game_data?.minPlayers || 2
                const currentPlayers = game.game_participants.length

                return (
                  <Card key={game.id} variant="neon">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <Badge variant={isLottery ? 'default' : 'secondary'}>
                            {isLottery ? '🎰 Lottery' : '⭕ Tic-Tac-Toe'}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {new Date(game.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Coins className="h-3 w-3" />
                            {game.bet_amount} pts
                          </Badge>
                          {isLottery && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {currentPlayers}/{minPlayers}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {!isLottery && game.game_participants[0] && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {game.game_participants[0].profiles.username}
                              </span>
                              {getVipBadge(game.game_participants[0].profiles.vip_level)}
                            </div>
                          )}
                          
                          <Button
                            onClick={() => joinGame(game.id, game.bet_amount, game.game_type, currentPlayers)}
                            disabled={loading || !profile || game.bet_amount > (profile?.points_balance || 0)}
                            size="sm"
                          >
                            {isLottery ? 'Buy Ticket' : 'Join Game'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}