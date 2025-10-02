import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Users, Clock, Coins, Zap, Trophy, ArrowLeft, Ticket } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { TicTacToe } from '@/components/game/TicTacToe'
import { Lottery } from '@/components/game/Lottery'
import { useNavigate } from 'react-router-dom'
import { TopNavBar } from '@/components/navigation/TopNavBar'

interface Game {
  id: string
  bet_amount: number
  status: string
  created_at: string
  game_type: string
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

export default function LiveGames() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [joiningGame, setJoiningGame] = useState<string | null>(null)
  const [currentGame, setCurrentGame] = useState<string | null>(null)

  useEffect(() => {
    fetchGames()
    const interval = setInterval(fetchGames, 3000) // Refresh every 3 seconds
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
          game_type,
          game_data,
          game_participants (
            user_id,
            player_number
          )
        `)
        .in('status', ['waiting', 'active'])
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

  const joinGame = async (gameId: string, gameBetAmount: number) => {
    if (!profile || profile.points_balance < gameBetAmount) {
      toast.error('Insufficient points!')
      return
    }

    setJoiningGame(gameId)
    try {
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

      // Update game status to active
      const { error: gameError } = await supabase
        .from('games')
        .update({ status: 'active' })
        .eq('id', gameId)

      if (gameError) throw gameError

      // Refresh profile to show updated balance
      await refreshProfile()

      toast.success('Game joined! Let\'s play!')
      
      // Immediately switch to game view
      setCurrentGame(gameId)
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to join game')
    } finally {
      setJoiningGame(null)
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
    return (
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Button 
            variant="outline" 
            onClick={() => setCurrentGame(null)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Live Games
          </Button>
          {game?.game_type === 'lottery' ? (
            <Lottery 
              gameId={currentGame}
              ticketPrice={game.bet_amount}
              minPlayers={game.game_data?.minPlayers || 2}
              onGameEnd={() => {
                setCurrentGame(null)
                fetchGames()
              }}
            />
          ) : (
            <TicTacToe 
              gameId={currentGame} 
              betAmount={game?.bet_amount || 100}
              onGameEnd={() => {
                setTimeout(() => {
                  setCurrentGame(null)
                  fetchGames()
                }, 3000)
              }}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Live Games Arena
            </h1>
            <p className="text-muted-foreground mt-2">
              Join ongoing games or watch others battle it out
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Separator className="mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Waiting Games */}
          <Card variant="neon">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Waiting for Players
              </CardTitle>
              <CardDescription>
                Join these games that need another player
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {games.filter(game => game.status === 'waiting').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No games waiting for players</p>
                    <p className="text-sm">Create a new game from the dashboard!</p>
                  </div>
                ) : (
                  games.filter(game => game.status === 'waiting').map((game) => (
                    <Card key={game.id} variant="neon" className="hover:bg-secondary/10 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {game.game_type === 'lottery' && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Ticket className="h-3 w-3 text-gaming-gold" />
                                  Lottery
                                </Badge>
                              )}
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Coins className="h-3 w-3" />
                                {game.bet_amount} pts
                              </Badge>
                              <Badge variant="secondary">Waiting</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(game.created_at).toLocaleTimeString()}
                              {game.game_type === 'lottery' && game.game_data?.minPlayers && (
                                <span className="ml-2">
                                  ({game.game_participants.length}/{game.game_data.minPlayers} players)
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {game.game_participants[0] && game.game_type !== 'lottery' && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {game.game_participants[0].profiles.username}
                                </span>
                                {getVipBadge(game.game_participants[0].profiles.vip_level)}
                              </div>
                            )}
                            
                            <Button
                              onClick={() => joinGame(game.id, game.bet_amount)}
                              disabled={joiningGame === game.id || !profile || game.bet_amount > (profile?.points_balance || 0)}
                              size="sm"
                            >
                              {joiningGame === game.id ? 'Joining...' : game.game_type === 'lottery' ? 'Buy Ticket' : 'Join Game'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Games */}
          <Card variant="neon">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Games in Progress
              </CardTitle>
              <CardDescription>
                Watch these intense battles unfold
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {games.filter(game => game.status === 'active').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active games right now</p>
                  </div>
                ) : (
                  games.filter(game => game.status === 'active').map((game) => (
                    <Card key={game.id} variant="neon" className="hover:bg-secondary/10 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {game.game_type === 'lottery' && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Ticket className="h-3 w-3 text-gaming-gold" />
                                  Lottery
                                </Badge>
                              )}
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Coins className="h-3 w-3" />
                                {game.game_type === 'lottery' 
                                  ? `${game.bet_amount * game.game_participants.length} pts pool`
                                  : `${game.bet_amount} pts`
                                }
                              </Badge>
                              <Badge variant="default" className="animate-pulse">Active</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              {game.game_participants.slice(0, game.game_type === 'lottery' ? 3 : 2).map((participant, index) => (
                                <div key={participant.user_id} className="flex items-center gap-1">
                                  <span className="font-medium">
                                    {participant.profiles.username}
                                  </span>
                                  {getVipBadge(participant.profiles.vip_level)}
                                </div>
                              ))}
                              {game.game_type === 'lottery' && game.game_participants.length > 3 && (
                                <span className="text-muted-foreground">+{game.game_participants.length - 3} more</span>
                              )}
                            </div>
                          </div>
                          
                          <Button
                            onClick={() => setCurrentGame(game.id)}
                            variant="outline"
                            size="sm"
                          >
                            {game.game_type === 'lottery' ? 'View Draw' : 'Watch Game'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="neon">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {games.filter(g => g.status === 'waiting').length}
              </div>
              <p className="text-sm text-muted-foreground">Games Waiting</p>
            </CardContent>
          </Card>
          
          <Card variant="neon">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">
                {games.filter(g => g.status === 'active').length}
              </div>
              <p className="text-sm text-muted-foreground">Games Active</p>
            </CardContent>
          </Card>
          
          <Card variant="neon">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gaming-gold">
                {profile?.points_balance || 0}
              </div>
              <p className="text-sm text-muted-foreground">Your Balance</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}