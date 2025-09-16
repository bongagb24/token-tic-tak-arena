import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  User, 
  Camera, 
  Star, 
  Trophy, 
  TrendingUp, 
  Coins,
  Edit3,
  Save,
  X
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export function UserProfile() {
  const { profile, user } = useAuth()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    username: profile?.username || '',
    avatar_url: profile?.avatar_url || ''
  })

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

  const handleSave = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          username: formData.username,
          avatar_url: formData.avatar_url
        })
        .eq('user_id', user.id)

      if (error) throw error

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      display_name: profile?.display_name || '',
      username: profile?.username || '',
      avatar_url: profile?.avatar_url || ''
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card variant="neon" className="backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-neon-green" />
              Profile Information
            </CardTitle>
            {!isEditing ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="border-neon-green/30 hover:border-neon-green"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSave}
                  disabled={loading}
                  className="border-neon-green/50 hover:border-neon-green text-neon-green"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  className="border-red-500/30 hover:border-red-500 text-red-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-neon-green/30">
                <AvatarImage src={formData.avatar_url} alt={formData.display_name} />
                <AvatarFallback className="bg-gaming-dark border border-neon-green/20 text-neon-green text-lg">
                  {formData.display_name?.charAt(0)?.toUpperCase() || 'P'}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button 
                  size="sm" 
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50"
                  variant="outline"
                >
                  <Camera className="h-4 w-4 text-neon-green" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="display_name" className="text-neon-green">Display Name</Label>
                    <Input
                      id="display_name"
                      value={formData.display_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                      className="border-neon-green/30 focus:border-neon-green bg-gaming-dark/50"
                      placeholder="Enter display name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-neon-green">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className="border-neon-green/30 focus:border-neon-green bg-gaming-dark/50"
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="avatar_url" className="text-neon-green">Avatar URL</Label>
                    <Input
                      id="avatar_url"
                      value={formData.avatar_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                      className="border-neon-green/30 focus:border-neon-green bg-gaming-dark/50"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold text-white">{profile?.display_name || 'Player'}</h3>
                  <p className="text-muted-foreground">@{profile?.username}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Star className="h-4 w-4 text-gaming-gold" />
                    <Badge variant={getVipColor(profile?.vip_level || 0)}>
                      {getVipLevel(profile?.vip_level || 0)}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <Tabs defaultValue="stats" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-gaming-dark/50 border border-neon-green/20">
          <TabsTrigger value="stats" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">Stats</TabsTrigger>
          <TabsTrigger value="achievements" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">Achievements</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">Game History</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="neon" className="backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-2xl font-bold flex items-center gap-1 text-gaming-gold">
                      <Coins className="h-5 w-5" />
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
                    <p className="text-2xl font-bold flex items-center gap-1 text-gaming-gold">
                      <Trophy className="h-5 w-5" />
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
                    <p className="text-sm text-muted-foreground">Games Played</p>
                    <p className="text-2xl font-bold flex items-center gap-1 text-white">
                      <Trophy className="h-5 w-5" />
                      {profile?.total_games_played || 0}
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
                    <p className="text-2xl font-bold flex items-center gap-1 text-neon-green">
                      <TrendingUp className="h-5 w-5" />
                      {winRate}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card variant="neon" className="backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your gaming milestones and rewards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No achievements unlocked yet. Start playing to earn rewards!</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card variant="neon" className="backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Recent Games</CardTitle>
              <CardDescription>Your gaming activity history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No games played yet. Join a game to see your history!</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}