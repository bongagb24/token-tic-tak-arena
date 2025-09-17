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

interface Game {
  id: string
  bet_amount: number
  status: string
  created_at: string
  game_data: any
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
  const [currentGameData, setCurrentGameData] = useState<Game | null>(null)

  useEffect(() => {
    fetchGames()
    const interval = setInterval(fetchGames, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
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
      // Create game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          bet_amount: betAmount,
          status: 'waiting',
          game_data: {
            board: Array(9).fill(null),
            currentPlayer: 'X',
            created_by: profile.user_id
          }
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

      toast.success('Game created! Waiting for opponent...')
      setCurrentGame(game.id)
      setCurrentGameData({ ...game, game_participants: [{ user_id: profile.user_id, player_number: 1, profiles: { username: profile.username, vip_level: profile.vip_level } }] })
      fetchGames()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const joinGame = async (gameId: string, gameBetAmount: number) => {
    if (!profile || profile.points_balance < gameBetAmount) {
      toast.error('Insufficient points!')
      return
    }

    setLoading(true)
    try {
      // Get the game data first
      const { data: gameData, error: gameDataError } = await supabase
        .from('games')
        .select(`
          *,
          game_participants (
            user_id,
            player_number,
            profiles:user_id (
              username,
              vip_level
            )
          )
        `)
        .eq('id', gameId)
        .single()

      if (gameDataError) throw gameDataError

      // Deduct points using database function
      const { error: pointsError } = await supabase.rpc('deduct_game_points', {
        p_user_id: profile.user_id,
        p_game_id: gameId,
        p_bet_amount: gameBetAmount,
        p_transaction_type: 'game_join'
      })

      if (pointsError) throw pointsError

      // Join the game as player 2
      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          game_id: gameId,
          user_id: profile.user_id,
          player_number: 2
        })

      if (participantError) throw participantError

      // Update game status to active and initialize game data
      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          status: 'active',
          game_data: {
            board: Array(9).fill(null),
            currentPlayer: 'X',
            gameStarted: true,
            startTime: new Date().toISOString()
          }
        })
        .eq('id', gameId)

      if (gameError) throw gameError

      // Refresh profile to show updated balance
      await refreshProfile()

      toast.success('Joined game! Let the battle begin!')
      setCurrentGame(gameId)
      setCurrentGameData(gameData)
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
    const playerNumber = currentGameData?.game_participants?.find(p => p.user_id === profile?.user_id)?.player_number || 1
    const opponent = currentGameData?.game_participants?.find(p => p.user_id !== profile?.user_id)
    const opponentName = opponent?.profiles?.username || 'Opponent'

    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => {
            setCurrentGame(null)
            setCurrentGameData(null)
          }}
          className="mb-4"
        >
          ← Back to Lobby
        </Button>
        <TicTacToe 
          gameId={currentGame} 
          betAmount={betAmount}
          playerNumber={playerNumber}
          opponentName={opponentName}
          onGameEnd={() => {
            setTimeout(() => {
              setCurrentGame(null)
              setCurrentGameData(null)
              fetchGames()
              refreshProfile()
            }, 3000)
          }}
        />
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
            Challenge players to a Tic-Tac-Toe duel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bet">Bet Amount (Points)</Label>
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
            {loading ? 'Creating...' : 'Create Game'}
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
              {games.map((game) => (
                <Card key={game.id} variant="neon">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
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
                        <Badge variant="secondary" className="text-xs">
                          {game.game_participants.length}/2 Players
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {game.game_participants[0] && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {game.game_participants[0].profiles.username}
                            </span>
                            {getVipBadge(game.game_participants[0].profiles.vip_level)}
                          </div>
                        )}
                        
                        <Button
                          onClick={() => joinGame(game.id, game.bet_amount)}
                          disabled={loading || !profile || game.bet_amount > (profile?.points_balance || 0)}
                          size="sm"
                          className="bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50 text-neon-green"
                        >
                          {loading ? 'Joining...' : 'Challenge!'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}