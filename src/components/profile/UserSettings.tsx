import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  Shield, 
  Bell, 
  CreditCard,
  Download,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'

export function UserSettings() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState({
    gameInvites: true,
    gameResults: true,
    promotions: false,
    email: true
  })

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }))
    toast({
      title: "Settings Updated",
      description: "Notification preferences have been saved.",
    })
  }

  const handleDeleteAccount = () => {
    // This would typically show a confirmation dialog
    toast({
      title: "Account Deletion",
      description: "Please contact support to delete your account.",
      variant: "destructive"
    })
  }

  const handleExportData = () => {
    toast({
      title: "Data Export",
      description: "Your data export will be ready shortly.",
    })
  }

  return (
    <div className="space-y-6">
      <Card variant="neon" className="backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-neon-green" />
            Account Settings
          </CardTitle>
          <CardDescription>
            Manage your account preferences and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="notifications" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 bg-gaming-dark/50 border border-neon-green/20">
              <TabsTrigger value="notifications" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="billing" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="data" className="data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green">
                <Download className="h-4 w-4 mr-2" />
                Data
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notifications" className="space-y-4">
              <Card variant="neon" className="backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Notification Preferences</CardTitle>
                  <CardDescription>Choose what notifications you want to receive</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Game Invites</Label>
                      <p className="text-sm text-muted-foreground">Get notified when someone challenges you</p>
                    </div>
                    <Switch
                      checked={notifications.gameInvites}
                      onCheckedChange={(value) => handleNotificationChange('gameInvites', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Game Results</Label>
                      <p className="text-sm text-muted-foreground">Get notified about game outcomes</p>
                    </div>
                    <Switch
                      checked={notifications.gameResults}
                      onCheckedChange={(value) => handleNotificationChange('gameResults', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Promotions</Label>
                      <p className="text-sm text-muted-foreground">Receive updates about special offers</p>
                    </div>
                    <Switch
                      checked={notifications.promotions}
                      onCheckedChange={(value) => handleNotificationChange('promotions', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(value) => handleNotificationChange('email', value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card variant="neon" className="backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Security Settings</CardTitle>
                  <CardDescription>Manage your account security and login preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-email">Current Email</Label>
                    <Input
                      id="current-email"
                      value={user?.email || ''}
                      disabled
                      className="border-neon-green/30 bg-gaming-dark/50"
                    />
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full border-neon-green/30 hover:border-neon-green"
                  >
                    Change Password
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full border-neon-green/30 hover:border-neon-green"
                  >
                    Enable Two-Factor Authentication
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4">
              <Card variant="neon" className="backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Billing & Payments</CardTitle>
                  <CardDescription>Manage your payment methods and transaction history</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">No payment methods configured</p>
                    <Button 
                      variant="outline" 
                      className="border-neon-green/30 hover:border-neon-green"
                    >
                      Add Payment Method
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data" className="space-y-4">
              <Card variant="neon" className="backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Data Management</CardTitle>
                  <CardDescription>Export your data or manage your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    variant="outline" 
                    onClick={handleExportData}
                    className="w-full border-neon-green/30 hover:border-neon-green"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </Button>
                  
                  <div className="border-t border-neon-green/20 pt-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                        <h4 className="font-semibold text-red-400">Danger Zone</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={handleDeleteAccount}
                        className="border-red-500/30 hover:border-red-500 text-red-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}