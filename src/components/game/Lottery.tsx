import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Users, Ticket, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface LotteryProps {
  gameId: string
  ticketPrice: number
  minPlayers: number
  onGameEnd?: () => void
}

interface Participant {
  user_id: string
  ticket_numbers: number[]
  profiles: {
    username: string
    vip_level: number
  }
}

export function Lottery({ gameId, ticketPrice, minPlayers, onGameEnd }: LotteryProps) {
  const { profile, refreshProfile } = useAuth()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [winner, setWinner] = useState<string | null>(null)
  const [winningTicket, setWinningTicket] = useState<number | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [spinningNumber, setSpinningNumber] = useState<number | null>(null)

  useEffect(() => {
    fetchParticipants()
    fetchGameData()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`lottery-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_participants',
          filter: `game_id=eq.${gameId}`
        },
        () => {
          fetchParticipants()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        async (payload) => {
          const gameData = payload.new.game_data as any
          if (gameData?.winner) {
            setWinner(gameData.winner)
            await refreshProfile()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  useEffect(() => {
    if (!expiresAt) return

    const updateTimer = () => {
      const now = Date.now()
      const expiry = new Date(expiresAt).getTime()
      const remaining = Math.max(0, expiry - now)
      setTimeRemaining(remaining)

      // Auto-draw or cancel when time expires
      if (remaining === 0 && !winner && !isDrawing) {
        if (participants.length >= minPlayers) {
          drawWinner()
        } else {
          cancelLottery()
        }
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, winner, isDrawing, participants.length, minPlayers])

  const fetchGameData = async () => {
    const { data } = await supabase
      .from('games')
      .select('game_data')
      .eq('id', gameId)
      .single()

    if (data?.game_data) {
      const gameData = data.game_data as any
      if (gameData.expiresAt) {
        setExpiresAt(gameData.expiresAt)
      }
    }
  }

  const cancelLottery = async () => {
    try {
      // Refund all participants
      for (const participant of participants) {
        await supabase.rpc('reward_game_points', {
          p_user_id: participant.user_id,
          p_game_id: gameId,
          p_reward_amount: ticketPrice
        })
      }

      // Mark game as completed
      await supabase
        .from('games')
        .update({ status: 'cancelled' })
        .eq('id', gameId)

      toast.error('Lottery cancelled - not enough players. Tickets refunded.')
      
      setTimeout(() => {
        onGameEnd?.()
      }, 3000)
    } catch (error: any) {
      toast.error('Failed to cancel lottery: ' + error.message)
    }
  }

  const fetchParticipants = async () => {
    const { data } = await supabase
      .from('game_participants')
      .select(`
        user_id,
        ticket_numbers,
        profiles:user_id (
          username,
          vip_level
        )
      `)
      .eq('game_id', gameId)

    if (data) {
      setParticipants(data as any)
    }
  }

  const buyTicket = async () => {
    if (!profile) return
    
    setLoading(true)
    try {
      // Deduct points
      const { error: deductError } = await supabase.rpc('deduct_game_points', {
        p_user_id: profile.user_id,
        p_game_id: gameId,
        p_bet_amount: ticketPrice,
        p_transaction_type: 'game_join'
      })

      if (deductError) throw deductError

      // Get current game data to determine next ticket number
      const { data: gameData } = await supabase
        .from('games')
        .select('game_data')
        .eq('id', gameId)
        .single()

      const currentGameData = gameData?.game_data as any || {}
      const nextTicketNumber = (currentGameData.totalTickets || 0) + 1

      // Check if user already has tickets
      const existingParticipant = participants.find(p => p.user_id === profile.user_id)

      if (existingParticipant) {
        // Update existing participant with new ticket
        const updatedTickets = [...existingParticipant.ticket_numbers, nextTicketNumber]
        await supabase
          .from('game_participants')
          .update({ ticket_numbers: updatedTickets })
          .eq('game_id', gameId)
          .eq('user_id', profile.user_id)
      } else {
        // Create new participant
        await supabase
          .from('game_participants')
          .insert({
            game_id: gameId,
            user_id: profile.user_id,
            player_number: participants.length + 1,
            ticket_numbers: [nextTicketNumber]
          })
      }

      // Update game data with new total ticket count
      await supabase
        .from('games')
        .update({
          game_data: {
            ...currentGameData,
            totalTickets: nextTicketNumber
          }
        })
        .eq('id', gameId)

      toast.success(`Ticket #${nextTicketNumber} purchased!`)
      await refreshProfile()
      fetchParticipants()
    } catch (error: any) {
      toast.error('Failed to buy ticket: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const drawWinner = async () => {
    if (participants.length < minPlayers) {
      toast.error(`Need at least ${minPlayers} players to draw!`)
      return
    }

    setIsDrawing(true)
    setLoading(true)

    try {
      // Get all tickets
      const allTickets: Array<{ ticketNumber: number, userId: string, username: string }> = []
      participants.forEach(participant => {
        participant.ticket_numbers.forEach(ticketNum => {
          allTickets.push({
            ticketNumber: ticketNum,
            userId: participant.user_id,
            username: participant.profiles.username
          })
        })
      })

      if (allTickets.length === 0) {
        toast.error('No tickets available!')
        return
      }

      // Spinning animation
      const spinDuration = 3000
      const spinInterval = 100
      const spinStart = Date.now()
      
      const spinAnimation = setInterval(() => {
        const randomTicket = allTickets[Math.floor(Math.random() * allTickets.length)]
        setSpinningNumber(randomTicket.ticketNumber)
        
        if (Date.now() - spinStart > spinDuration) {
          clearInterval(spinAnimation)
        }
      }, spinInterval)

      // Wait for spin animation to complete
      await new Promise(resolve => setTimeout(resolve, spinDuration))

      // Select winning ticket
      const winningTicketData = allTickets[Math.floor(Math.random() * allTickets.length)]
      const winnerId = winningTicketData.userId
      const winnerUsername = winningTicketData.username
      const winningTicketNumber = winningTicketData.ticketNumber

      setWinningTicket(winningTicketNumber)
      setSpinningNumber(null)

      // Calculate prize (total pot)
      const totalPot = ticketPrice * allTickets.length

      // Update game with winner
      const { error: updateError } = await supabase
        .from('games')
        .update({
          status: 'completed',
          winner_id: winnerId,
          completed_at: new Date().toISOString(),
          game_data: {
            winner: winnerId,
            winnerUsername,
            totalPlayers: participants.length,
            totalTickets: allTickets.length,
            prizeAmount: totalPot,
            winningTicket: winningTicketNumber
          }
        })
        .eq('id', gameId)

      if (updateError) throw updateError

      // Reward winner
      const { error: rewardError } = await supabase.rpc('reward_game_points', {
        p_user_id: winnerId,
        p_game_id: gameId,
        p_reward_amount: totalPot
      })

      if (rewardError) throw rewardError

      // Handle losers
      for (const participant of participants) {
        if (participant.user_id !== winnerId) {
          await supabase.rpc('handle_game_loss', {
            p_user_id: participant.user_id,
            p_game_id: gameId
          })
        }
      }

      setWinner(winnerId)
      toast.success(`🎉 Ticket #${winningTicketNumber} wins! ${winnerUsername} won ${totalPot} points!`)

      setTimeout(() => {
        onGameEnd?.()
      }, 5000)
    } catch (error: any) {
      toast.error('Failed to draw winner: ' + error.message)
    } finally {
      setIsDrawing(false)
      setLoading(false)
    }
  }

  const hasJoined = participants.some(p => p.user_id === profile?.user_id)
  const canDraw = participants.length >= minPlayers && !winner && timeRemaining > 0
  const totalTickets = participants.reduce((sum, p) => sum + p.ticket_numbers.length, 0)
  const totalPot = ticketPrice * totalTickets
  const userTickets = participants.find(p => p.user_id === profile?.user_id)?.ticket_numbers || []

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const isExpired = timeRemaining === 0

  return (
    <div className="space-y-6">
      <Card variant="neon" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gaming-gold/10 via-transparent to-gaming-bronze/10" />
        
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Ticket className="h-6 w-6 text-gaming-gold" />
            Lottery Draw
          </CardTitle>
          <CardDescription className="flex items-center justify-between">
            <span>Ticket Price: {ticketPrice} points • Minimum Players: {minPlayers}</span>
            <span className={`font-mono font-bold ${timeRemaining < 60000 ? 'text-destructive animate-pulse' : 'text-gaming-gold'}`}>
              ⏱️ {formatTime(timeRemaining)}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="relative space-y-6">
          {/* Spinning Number Display */}
          {isDrawing && spinningNumber && (
            <div className="text-center p-8 bg-gaming-dark/80 rounded-lg border-2 border-gaming-gold animate-pulse">
              <p className="text-sm text-muted-foreground mb-2">Drawing Ticket...</p>
              <p className="text-6xl font-bold text-gaming-gold animate-bounce">#{spinningNumber}</p>
            </div>
          )}

          {/* Prize Pool */}
          <div className="text-center p-6 bg-gaming-dark/50 rounded-lg border border-gaming-gold/20">
            <p className="text-sm text-muted-foreground mb-2">Total Prize Pool</p>
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-8 w-8 text-gaming-gold animate-pulse" />
              <p className="text-4xl font-bold text-gaming-gold">{totalPot}</p>
              <span className="text-muted-foreground">points</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{totalTickets} tickets sold</p>
          </div>

          {/* User's Tickets */}
          {userTickets.length > 0 && (
            <div className="p-4 bg-neon-green/10 rounded-lg border border-neon-green/30">
              <p className="text-sm font-semibold mb-2">Your Tickets:</p>
              <div className="flex flex-wrap gap-2">
                {userTickets.map(ticketNum => (
                  <Badge 
                    key={ticketNum} 
                    variant="outline" 
                    className={`${
                      ticketNum === winningTicket 
                        ? 'bg-gaming-gold text-gaming-dark border-gaming-gold' 
                        : 'border-neon-green text-neon-green'
                    }`}
                  >
                    #{ticketNum}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Buy Ticket Button */}
          {!winner && !isExpired && (
            <Button
              onClick={buyTicket}
              disabled={loading || !profile}
              className="w-full bg-neon-green hover:bg-neon-green/90 text-gaming-dark"
              size="lg"
            >
              <Ticket className="mr-2 h-5 w-5" />
              Buy Ticket ({ticketPrice} points)
            </Button>
          )}

          {/* Winner Announcement */}
          {winner && winningTicket && (
            <Card className="bg-gradient-to-r from-gaming-gold/20 to-gaming-bronze/20 border-gaming-gold">
              <CardContent className="p-6 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-gaming-gold animate-bounce" />
                <h3 className="text-2xl font-bold mb-2">🎉 Winner! 🎉</h3>
                <div className="text-3xl font-bold text-gaming-gold mb-2">Ticket #{winningTicket}</div>
                <p className="text-lg">
                  {participants.find(p => p.user_id === winner)?.profiles.username} won {totalPot} points!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participants.length}/{minPlayers} minimum)
              </h3>
              {canDraw && hasJoined && (
                <Button
                  onClick={drawWinner}
                  disabled={loading || isDrawing}
                  className="bg-gaming-gold hover:bg-gaming-gold/90 text-gaming-dark"
                >
                  {isDrawing ? 'Drawing...' : '🎲 Draw Winner'}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {participants.map((participant) => (
                <Card key={participant.user_id} variant="neon">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{participant.profiles.username}</span>
                        <Badge variant="secondary" className="text-xs">
                          {participant.ticket_numbers.length} ticket{participant.ticket_numbers.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {participant.profiles.vip_level > 0 && (
                          <Badge variant="outline" className="text-xs">
                            VIP {participant.profiles.vip_level}
                          </Badge>
                        )}
                        {participant.user_id === winner && (
                          <Badge className="bg-gaming-gold text-gaming-dark">
                            WINNER
                          </Badge>
                        )}
                      </div>
                    </div>
                    {participant.ticket_numbers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {participant.ticket_numbers.map(ticketNum => (
                          <span 
                            key={ticketNum} 
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              ticketNum === winningTicket 
                                ? 'bg-gaming-gold text-gaming-dark font-bold' 
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            #{ticketNum}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Status Info */}
          {!winner && (
            <div className="text-center text-sm text-muted-foreground">
              {isExpired ? (
                <p className="text-destructive font-semibold">
                  ⏰ Time expired! {participants.length >= minPlayers ? 'Drawing winner...' : 'Refunding tickets...'}
                </p>
              ) : participants.length < minPlayers ? (
                <p>Waiting for {minPlayers - participants.length} more player(s) to join...</p>
              ) : (
                <p>Ready to draw! Any participant can trigger the draw or wait for timer.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
