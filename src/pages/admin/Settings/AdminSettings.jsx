import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  Button,
  TextField,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Language as LanguageIcon,
  Palette as PaletteIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import './adminSettings.scss';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: true,
      desktop: false,
    },
    security: {
      twoFactor: false,
      passwordExpiry: '30',
      sessionTimeout: '60',
    },
    appearance: {
      theme: 'system',
      language: 'en',
      fontSize: 'medium',
    }
  });

  const handleNotificationChange = (type) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type]
      }
    }));
  };

  const handleSecurityChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [field]: value
      }
    }));
  };

  const handleAppearanceChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    // Implement API call to save settings
    toast.success('Settings saved successfully');
  };

  return (
    <div className="settingsContainer">
      <Typography variant="h5" component="h1" className="pageTitle">
        Admin Settings
      </Typography>

      <div className="settingsGrid">
        <Card className="settingsCard">
          <CardContent>
            <div className="cardHeader">
              <NotificationsIcon />
              <Typography variant="h6">Notifications</Typography>
            </div>
            <Divider />
            <Box className="settingsList">
              <div className="settingItem">
                <Typography>Email Notifications</Typography>
                <Switch
                  checked={settings.notifications.email}
                  onChange={() => handleNotificationChange('email')}
                />
              </div>
              <div className="settingItem">
                <Typography>Push Notifications</Typography>
                <Switch
                  checked={settings.notifications.push}
                  onChange={() => handleNotificationChange('push')}
                />
              </div>
              <div className="settingItem">
                <Typography>Desktop Notifications</Typography>
                <Switch
                  checked={settings.notifications.desktop}
                  onChange={() => handleNotificationChange('desktop')}
                />
              </div>
            </Box>
          </CardContent>
        </Card>

        <Card className="settingsCard">
          <CardContent>
            <div className="cardHeader">
              <SecurityIcon />
              <Typography variant="h6">Security</Typography>
            </div>
            <Divider />
            <Box className="settingsList">
              <div className="settingItem">
                <Typography>Two-Factor Authentication</Typography>
                <Switch
                  checked={settings.security.twoFactor}
                  onChange={() => handleSecurityChange('twoFactor', !settings.security.twoFactor)}
                />
              </div>
              <div className="settingItem">
                <Typography>Password Expiry (days)</Typography>
                <TextField
                  type="number"
                  size="small"
                  value={settings.security.passwordExpiry}
                  onChange={(e) => handleSecurityChange('passwordExpiry', e.target.value)}
                />
              </div>
              <div className="settingItem">
                <Typography>Session Timeout (minutes)</Typography>
                <TextField
                  type="number"
                  size="small"
                  value={settings.security.sessionTimeout}
                  onChange={(e) => handleSecurityChange('sessionTimeout', e.target.value)}
                />
              </div>
            </Box>
          </CardContent>
        </Card>

        <Card className="settingsCard">
          <CardContent>
            <div className="cardHeader">
              <PaletteIcon />
              <Typography variant="h6">Appearance</Typography>
            </div>
            <Divider />
            <Box className="settingsList">
              <div className="settingItem">
                <Typography>Theme</Typography>
                <FormControl size="small">
                  <Select
                    value={settings.appearance.theme}
                    onChange={(e) => handleAppearanceChange('theme', e.target.value)}
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="system">System</MenuItem>
                  </Select>
                </FormControl>
              </div>
              <div className="settingItem">
                <Typography>Language</Typography>
                <FormControl size="small">
                  <Select
                    value={settings.appearance.language}
                    onChange={(e) => handleAppearanceChange('language', e.target.value)}
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="es">Spanish</MenuItem>
                    <MenuItem value="fr">French</MenuItem>
                  </Select>
                </FormControl>
              </div>
              <div className="settingItem">
                <Typography>Font Size</Typography>
                <FormControl size="small">
                  <Select
                    value={settings.appearance.fontSize}
                    onChange={(e) => handleAppearanceChange('fontSize', e.target.value)}
                  >
                    <MenuItem value="small">Small</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="large">Large</MenuItem>
                  </Select>
                </FormControl>
              </div>
            </Box>
          </CardContent>
        </Card>
      </div>

      <Box className="actionButtons">
        <Button variant="contained" color="primary" onClick={handleSave}>
          Save Changes
        </Button>
      </Box>
    </div>
  );
};

export default AdminSettings;
