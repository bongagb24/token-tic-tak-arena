import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Gamepad2, 
  Trophy, 
  Coins, 
  TrendingUp, 
  Users, 
  Star,
  LogOut,
  Settings
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { GameLobby } from '@/components/game/GameLobby'
import { UserProfile } from '@/components/profile/UserProfile'
import { UserSettings } from '@/components/profile/UserSettings'
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

  const handleSignOut = async () => {
    await signOut()
  }

  const winRate = profile?.total_games_played 
    ? Math.round((profile.total_games_won / profile.total_games_played) * 100)
    : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Gaming Arena" 
            className="w-full h-64 object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>
        
        <div className="relative px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-8 w-8 text-primary" />
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    GameArena
                  </h1>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>

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
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            Welcome back, {profile?.display_name || profile?.username}!
          </h2>
          <p className="text-muted-foreground">
            Ready for your next gaming challenge?
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="lobby">Game Lobby</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="vip">VIP Zone</TabsTrigger>
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