import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Trophy, 
  Coins, 
  TrendingUp, 
  Users, 
  Star
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { GameLobby } from '@/components/game/GameLobby'
import { UserProfile } from '@/components/profile/UserProfile'
import { UserSettings } from '@/components/profile/UserSettings'
import { TopNavBar } from '@/components/navigation/TopNavBar'
import heroImage from '@/assets/gaming-hero.jpg'

export function GameDashboard() {
  const { user, profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('lobby')

  const getVipLevel = (level: number) => {
    const levels = ['Free Player', 'VIP Bronze', 'VIP Silver', 'VIP Gold']
    return levels[level] || 'VIP Elite'
  }

  const getVipColor = (level: number): "default" | "secondary" | "destructive" | "outline" => {
    const colors: ("default" | "secondary" | "destructive" | "outline")[] = ['secondary', 'outline', 'default', 'default']
    return colors[level] || 'default'
  }


  const winRate = profile?.total_games_played 
    ? Math.round((profile.total_games_won / profile.total_games_played) * 100)
    : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <TopNavBar onNavigate={setActiveTab} />
      
      {/* Welcome Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Gaming Arena" 
            className="w-full h-48 object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
        </div>
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Welcome back, {profile?.display_name || profile?.username || 'Gamer'}!
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Ready for your next gaming challenge? Let's dominate the arena!
            </p>

            {/* Player Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card variant="neon" className="backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Balance</p>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        <Coins className="h-5 w-5 text-gaming-gold" />
                        {profile?.points_balance || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="neon" className="backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Games Won</p>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        <Trophy className="h-5 w-5 text-gaming-gold" />
                        {profile?.total_games_won || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="neon" className="backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        <TrendingUp className="h-5 w-5 text-neon-green" />
                        {winRate}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="neon" className="backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">VIP Status</p>
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-gaming-gold" />
                        <Badge variant={getVipColor(profile?.vip_level || 0)}>
                          {getVipLevel(profile?.vip_level || 0)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-gaming-dark/50 border border-neon-green/20">
            <TabsTrigger value="lobby" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">Game Lobby</TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">My Account</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">Settings</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">History</TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">Leaderboard</TabsTrigger>
            <TabsTrigger value="vip" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">VIP Zone</TabsTrigger>
          </TabsList>

          <TabsContent value="lobby">
            <GameLobby />
          </TabsContent>

          <TabsContent value="profile">
            <UserProfile />
          </TabsContent>

          <TabsContent value="settings">
            <UserSettings />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Game History</CardTitle>
                <CardDescription>
                  Your recent gaming activity and statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No games played yet. Start your first game!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>
                  Top players in the gaming arena
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Leaderboard coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vip">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-gaming-gold" />
                  VIP Zone
                </CardTitle>
                <CardDescription>
                  Exclusive benefits and higher stakes games
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <div className="bg-gradient-to-r from-gaming-gold/20 to-gaming-bronze/20 rounded-lg p-6 mb-4">
                    <h3 className="text-xl font-bold mb-2">Unlock VIP Benefits</h3>
                    <p className="text-muted-foreground mb-4">
                      Play more games to unlock VIP levels and exclusive features
                    </p>
                    <div className="space-y-2 text-left">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">VIP 1</Badge>
                        <span className="text-sm">Bet up to 5,000 points</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">VIP 2</Badge>
                        <span className="text-sm">Bet up to 20,000 points</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">VIP 3</Badge>
                        <span className="text-sm">Unlimited betting</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}