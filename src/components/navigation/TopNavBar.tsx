import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Gamepad2, 
  Settings, 
  LogOut,
  User,
  Crown,
  Menu,
  Home,
  Trophy,
  Users
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface TopNavBarProps {
  onNavigate?: (section: string) => void
}

export function TopNavBar({ onNavigate }: TopNavBarProps) {
  const { user, profile, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-neon-green/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Navigation Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto p-2 hover:bg-neon-green/10">
                <Menu className="h-5 w-5 text-primary" />
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-8 w-8 text-primary" />
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    GameArena
                  </h1>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-gaming-dark border-neon-green/20" align="start" forceMount>
              <DropdownMenuLabel className="text-neon-green">Navigation</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-neon-green/20" />
              <DropdownMenuItem 
                onClick={() => onNavigate?.('dashboard')}
                className="cursor-pointer hover:bg-neon-green/10"
              >
                <Home className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onNavigate?.('games')}
                className="cursor-pointer hover:bg-neon-green/10"
              >
                <Gamepad2 className="mr-2 h-4 w-4" />
                <span>Games</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onNavigate?.('leaderboard')}
                className="cursor-pointer hover:bg-neon-green/10"
              >
                <Trophy className="mr-2 h-4 w-4" />
                <span>Leaderboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onNavigate?.('friends')}
                className="cursor-pointer hover:bg-neon-green/10"
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Friends</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {/* Points Display */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-neon-green/20 bg-gaming-dark/50">
              <Crown className="h-4 w-4 text-gaming-gold" />
              <span className="text-sm font-medium">{profile?.points_balance || 0} Points</span>
            </div>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-neon-green/20 hover:border-neon-green/40">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url} alt={profile?.display_name} />
                    <AvatarFallback className="bg-gaming-dark text-neon-green">
                      {getInitials(profile?.display_name || profile?.username)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-gaming-dark border-neon-green/20" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-neon-green">
                      {profile?.display_name || profile?.username}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neon-green/20" />
                <DropdownMenuItem 
                  onClick={() => onNavigate?.('profile')}
                  className="cursor-pointer hover:bg-neon-green/10"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onNavigate?.('settings')}
                  className="cursor-pointer hover:bg-neon-green/10"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-neon-green/20" />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="cursor-pointer hover:bg-red-500/10 text-red-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}