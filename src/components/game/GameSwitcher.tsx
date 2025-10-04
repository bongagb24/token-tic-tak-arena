import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, Coins, Ticket, Trophy, Gamepad2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { TicTacToe } from './TicTacToe'
import { Lottery } from './Lottery'
import { Pokie } from './Pokie'

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
    ticket_numbers?: number[]
    profiles: {
      username: string
      vip_level: number
    }
  }>
}

export function GameSwitcher() {
  const { profile, refreshProfile } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [currentGame, setCurrentGame] = useState<string | null>(null)
  const [selectedGameType, setSelectedGameType] = useState<'tictactoe' | 'lottery' | 'pokie'>('tictactoe')

  useEffect(() => {
    fetchGames()
    const interval = setInterval(fetchGames, 3000)
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
            player_number,
            ticket_numbers
          )
        `)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })

      if (error) throw error
      
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

  const joinGame = async (gameId: string, gameBetAmount: number, gameType: string, currentParticipants: number) => {
    if (!profile || profile.points_balance < gameBetAmount) {
      toast.error('Insufficient points!')
      return
    }

    setLoading(true)
    try {
      const { error: pointsError } = await supabase.rpc('deduct_game_points', {
        p_user_id: profile.user_id,
        p_game_id: gameId,
        p_bet_amount: gameBetAmount,
        p_transaction_type: 'game_join'
      })

      if (pointsError) throw pointsError

      let nextTicketNumber = 2
      if (gameType === 'lottery') {
        const { data: gameData } = await supabase
          .from('games')
          .select('game_data')
          .eq('id', gameId)
          .single()
        
        const currentGameData = gameData?.game_data as any || {}
        nextTicketNumber = (currentGameData.totalTickets || 1) + 1

        await supabase
          .from('games')
          .update({
            game_data: {
              ...currentGameData,
              totalTickets: nextTicketNumber
            }
          })
          .eq('id', gameId)
      }

      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          game_id: gameId,
          user_id: profile.user_id,
          player_number: gameType === 'lottery' ? currentParticipants + 1 : 2,
          ticket_numbers: gameType === 'lottery' ? [nextTicketNumber] : []
        })

      if (participantError) throw participantError

      if (gameType === 'tictactoe') {
        await supabase
          .from('games')
          .update({ status: 'active' })
          .eq('id', gameId)
      }

      await refreshProfile()
      toast.success(gameType === 'lottery' ? 'Ticket purchased!' : gameType === 'pokie' ? 'Pokie ready!' : 'Game joined!')
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
    const currentUserParticipant = game?.game_participants.find(
      p => p.user_id === profile?.user_id
    )
    const isPlayerOne = currentUserParticipant?.player_number === 1

    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => setCurrentGame(null)}
        >
          ← Back to Games
        </Button>
        {isLottery ? (
          <Lottery
            gameId={currentGame}
            ticketPrice={game?.bet_amount || 100}
            minPlayers={game?.game_data?.minPlayers || 3}
            onGameEnd={() => {
              setTimeout(() => {
                setCurrentGame(null)
                fetchGames()
              }, 3000)
            }}
          />
        ) : game?.game_type === 'pokie' ? (
          <Pokie
            gameId={currentGame}
            betAmount={game?.bet_amount || 100}
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
            betAmount={game?.bet_amount || 100}
            isPlayerOne={isPlayerOne}
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

  const ticTacToeGames = games.filter(g => g.game_type === 'tictactoe')
  const lotteryGames = games.filter(g => g.game_type === 'lottery')
  const pokieGames = games.filter(g => g.game_type === 'pokie')

  return (
    <div className="space-y-6">
      <Card variant="neon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6" />
            Multiplayer Games
          </CardTitle>
          <CardDescription>
            Choose your game and compete with players worldwide
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedGameType} onValueChange={(v) => setSelectedGameType(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tictactoe">
                ⭕ Tic-Tac-Toe
              </TabsTrigger>
              <TabsTrigger value="lottery">
                🎰 Lottery
              </TabsTrigger>
              <TabsTrigger value="pokie">
                🎰 Pokie
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tictactoe" className="space-y-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Available Tic-Tac-Toe Games</h3>
                <Badge variant="secondary">
                  {ticTacToeGames.length} games
                </Badge>
              </div>

              {ticTacToeGames.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No active Tic-Tac-Toe games</p>
                  <p className="text-sm mt-2">Create one from the dashboard to start playing!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticTacToeGames.map((game) => (
                    <Card key={game.id} variant="neon" className="hover:bg-accent/5 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
                                {game.status === 'active' ? '🔥 Active' : '⏳ Waiting'}
                              </Badge>
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Coins className="h-3 w-3" />
                                {game.bet_amount} pts
                              </Badge>
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(game.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            {game.game_participants[0] && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {game.game_participants[0].profiles.username}
                                </span>
                                {getVipBadge(game.game_participants[0].profiles.vip_level)}
                              </div>
                            )}
                          </div>
                          
                          {game.status === 'waiting' ? (
                            <Button
                              onClick={() => joinGame(game.id, game.bet_amount, game.game_type, game.game_participants.length)}
                              disabled={loading || !profile || game.bet_amount > (profile?.points_balance || 0)}
                              size="sm"
                            >
                              Join Game
                            </Button>
                          ) : (
                            <Button
                              onClick={() => setCurrentGame(game.id)}
                              variant="outline"
                              size="sm"
                            >
                              Watch
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="lottery" className="space-y-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Active Lottery Draws</h3>
                <Badge variant="secondary">
                  {lotteryGames.length} lotteries
                </Badge>
              </div>

              {lotteryGames.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Ticket className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No active lottery games</p>
                  <p className="text-sm mt-2">Create one from the dashboard to start!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lotteryGames.map((game) => {
                    const minPlayers = game.game_data?.minPlayers || 2
                    const currentPlayers = game.game_participants.length
                    const totalPot = game.bet_amount * (game.game_data?.totalTickets || currentPlayers)

                    return (
                      <Card key={game.id} variant="neon" className="hover:bg-accent/5 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
                                  {game.status === 'active' ? '🔥 Drawing' : '⏳ Waiting'}
                                </Badge>
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Ticket className="h-3 w-3" />
                                  {game.bet_amount} pts/ticket
                                </Badge>
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {currentPlayers}/{minPlayers}
                                </Badge>
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(game.created_at).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-gaming-gold">
                                  💰 {totalPot} pts prize pool
                                </span>
                              </div>
                            </div>
                            
                            {game.status === 'waiting' ? (
                              <Button
                                onClick={() => joinGame(game.id, game.bet_amount, game.game_type, currentPlayers)}
                                disabled={loading || !profile || game.bet_amount > (profile?.points_balance || 0)}
                                size="sm"
                              >
                                Buy Ticket
                              </Button>
                            ) : (
                              <Button
                                onClick={() => setCurrentGame(game.id)}
                                variant="outline"
                                size="sm"
                              >
                                View Draw
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pokie" className="space-y-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Pokie Machines (4x4)</h3>
                <Badge variant="secondary">
                  {pokieGames.length} machines
                </Badge>
              </div>

              {pokieGames.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No active pokie games</p>
                  <p className="text-sm mt-2">Create one from the dashboard to spin!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pokieGames.map((game) => (
                    <Card key={game.id} variant="neon" className="hover:bg-accent/5 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge variant={game.status === 'active' ? 'default' : 'secondary'}>
                                {game.status === 'active' ? '🎰 Spinning' : '⏳ Ready'}
                              </Badge>
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Coins className="h-3 w-3" />
                                {game.bet_amount} pts/spin
                              </Badge>
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(game.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            {game.game_participants[0] && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {game.game_participants[0].profiles.username}
                                </span>
                                {getVipBadge(game.game_participants[0].profiles.vip_level)}
                              </div>
                            )}
                          </div>
                          
                          <Button
                            onClick={() => setCurrentGame(game.id)}
                            variant={game.status === 'waiting' ? 'default' : 'outline'}
                            size="sm"
                          >
                            {game.status === 'waiting' ? 'Play' : 'Watch'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
