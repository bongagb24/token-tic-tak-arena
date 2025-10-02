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
  profiles: {
    username: string
    vip_level: number
  }
}

export function Lottery({ gameId, ticketPrice, minPlayers, onGameEnd }: LotteryProps) {
  const { profile, refreshProfile } = useAuth()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [winner, setWinner] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchParticipants()

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

  const fetchParticipants = async () => {
    const { data } = await supabase
      .from('game_participants')
      .select(`
        user_id,
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

  const drawWinner = async () => {
    if (participants.length < minPlayers) {
      toast.error(`Need at least ${minPlayers} players to draw!`)
      return
    }

    setIsDrawing(true)
    setLoading(true)

    try {
      // Random winner selection
      const randomIndex = Math.floor(Math.random() * participants.length)
      const winnerId = participants[randomIndex].user_id
      const winnerUsername = participants[randomIndex].profiles.username

      // Calculate prize (total pot)
      const totalPot = ticketPrice * participants.length

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
            prizeAmount: totalPot
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
      toast.success(`🎉 ${winnerUsername} won ${totalPot} points!`)

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
  const canDraw = participants.length >= minPlayers && !winner
  const totalPot = ticketPrice * participants.length

  return (
    <div className="space-y-6">
      <Card variant="neon" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gaming-gold/10 via-transparent to-gaming-bronze/10" />
        
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Ticket className="h-6 w-6 text-gaming-gold" />
            Lottery Draw
          </CardTitle>
          <CardDescription>
            Ticket Price: {ticketPrice} points • Minimum Players: {minPlayers}
          </CardDescription>
        </CardHeader>

        <CardContent className="relative space-y-6">
          {/* Prize Pool */}
          <div className="text-center p-6 bg-gaming-dark/50 rounded-lg border border-gaming-gold/20">
            <p className="text-sm text-muted-foreground mb-2">Total Prize Pool</p>
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-8 w-8 text-gaming-gold animate-pulse" />
              <p className="text-4xl font-bold text-gaming-gold">{totalPot}</p>
              <span className="text-muted-foreground">points</span>
            </div>
          </div>

          {/* Winner Announcement */}
          {winner && (
            <Card className="bg-gradient-to-r from-gaming-gold/20 to-gaming-bronze/20 border-gaming-gold">
              <CardContent className="p-6 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-gaming-gold" />
                <h3 className="text-2xl font-bold mb-2">🎉 Winner! 🎉</h3>
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
                      </div>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Status Info */}
          {!winner && (
            <div className="text-center text-sm text-muted-foreground">
              {participants.length < minPlayers ? (
                <p>Waiting for {minPlayers - participants.length} more player(s) to join...</p>
              ) : (
                <p>Ready to draw! Any participant can trigger the draw.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
