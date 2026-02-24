import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { CreateUserForm } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  
  // Redirect non-admin users
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [formData, setFormData] = useState<CreateUserForm>({
    name: '',
    email: '',
    password: '',
    role: '',
    department: 'Orthodontics' // Fixed to Orthodontics department
  });

  const roles = [
    { value: 'ADMIN', label: 'Administrator' },
    { value: 'ORTHODONTIST', label: 'Orthodontist' },
    { value: 'DENTAL_SURGEON', label: 'Dental Surgeon' },
    { value: 'NURSE', label: 'Nurse' },
    { value: 'RECEPTION', label: 'Receptionist' },
    { value: 'STUDENT', label: 'Student' }
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async (filters?: { search?: string; role?: string }) => {
    try {
      setLoading(true);
      setError(null);

      const activeSearch = (filters?.search ?? searchTerm).trim();
      const activeRole = (filters?.role ?? roleFilter).trim();
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const allUsers: User[] = [];

      do {
        const response = await apiService.users.getAll({
          page,
          limit: pageSize,
          search: activeSearch || undefined,
          role: activeRole || undefined
        });

        if (!response.success || !response.data) {
          setError('Failed to load users');
          break;
        }

        const pageUsers = response.data.users || response.data || [];
        allUsers.push(...pageUsers);

        const pagination = response.data.pagination;
        if (!pagination) {
          break;
        }

        totalPages = pagination.total_pages || 1;
        page += 1;
      } while (page <= totalPages);

      const dedupedUsers = Array.from(
        new Map(allUsers.map((u: User) => [u.id, u])).values()
      );

      setUsers(dedupedUsers);
      setTotalUsers(dedupedUsers.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    loadUsers();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setRoleFilter('');
    loadUsers({ search: '', role: '' });
  };

  const handleCreateUser = async () => {
    try {
      const response = await apiService.users.create(formData);
      
      if (response.success) {
        setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
        setCreateDialogOpen(false);
        setFormData({ name: '', email: '', password: '', role: '', department: 'Orthodontics' });
        loadUsers();
      } else {
        setSnackbar({ open: true, message: response.message || 'Failed to create user', severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || err.message || 'Failed to create user', severity: 'error' });
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const updateData: { name: string; email: string; role: string; department: string; password?: string } = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department
      };
      if (formData.password?.trim()) {
        updateData.password = formData.password.trim();
      }

      const response = await apiService.users.update(selectedUser.id, updateData);
      if (response.success) {
        setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
        setEditDialogOpen(false);
        setSelectedUser(null);
        setFormData({ name: '', email: '', password: '', role: '', department: 'Orthodontics' });
        loadUsers();
      } else {
        setSnackbar({ open: true, message: response.message || 'Failed to update user', severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || err.message || 'Failed to update user', severity: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await apiService.users.delete(userId);
      if (response.success) {
        setSnackbar({ open: true, message: 'User deleted successfully', severity: 'success' });
        loadUsers();
      } else {
        setSnackbar({ open: true, message: response.message || 'Failed to delete user', severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || err.message || 'Failed to delete user', severity: 'error' });
    }
  };

  const handleActivateUser = async (targetUser: User) => {
    try {
      const response = await apiService.users.update(targetUser.id, { status: 'ACTIVE' });
      if (response.success) {
        setSnackbar({ open: true, message: 'User activated successfully', severity: 'success' });
        loadUsers();
      } else {
        setSnackbar({ open: true, message: response.message || 'Failed to activate user', severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || err.message || 'Failed to activate user', severity: 'error' });
    }
  };

  const handlePermanentDeleteUser = async (targetUser: User) => {
    if (targetUser.status !== 'INACTIVE') {
      setSnackbar({ open: true, message: 'Deactivate the user first before permanent delete', severity: 'error' });
      return;
    }

    if (!window.confirm(`Permanently delete ${targetUser.email}? This cannot be undone.`)) return;

    try {
      const response = await apiService.users.delete(targetUser.id, true);
      if (response.success) {
        setSnackbar({ open: true, message: 'User permanently deleted', severity: 'success' });
        loadUsers();
      } else {
        setSnackbar({ open: true, message: response.message || 'Failed to permanently delete user', severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || err.message || 'Failed to permanently delete user', severity: 'error' });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department || ''
    });
    setEditDialogOpen(true);
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      'ADMIN': '#f44336',
      'ORTHODONTIST': '#2196f3',
      'DENTAL_SURGEON': '#4caf50',
      'NURSE': '#ff9800',
      'RECEPTION': '#9c27b0',
      'STUDENT': '#607d8b'
    };
    return colors[role] || '#757575';
  };

  const getStatusColor = (status: string) => {
    return status === 'ACTIVE' ? '#4caf50' : '#f44336';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading users...</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="body2" color="textSecondary">
          Total Users: {totalUsers}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Add User
        </Button>
      </Box>

      <Box
        display="flex"
        gap={2}
        alignItems="center"
        flexWrap="wrap"
        mb={2}
      >
        <TextField
          label="Search user"
          placeholder="Name or username/email"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyFilters();
            }
          }}
          size="small"
          sx={{ minWidth: 280 }}
        />
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Filter by role</InputLabel>
          <Select
            value={roleFilter}
            label="Filter by role"
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <MenuItem value="">All roles</MenuItem>
            {roles.map((role) => (
              <MenuItem key={role.value} value={role.value}>
                {role.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" onClick={applyFilters}>
          Apply
        </Button>
        <Button variant="outlined" onClick={resetFilters}>
          Reset
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role.replace('_', ' ')}
                      size="small"
                      style={{ backgroundColor: getRoleColor(user.role), color: 'white' }}
                    />
                  </TableCell>
                  <TableCell>{user.department || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.status}
                      size="small"
                      style={{ backgroundColor: getStatusColor(user.status), color: 'white' }}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => openEditDialog(user)}
                      sx={{ mr: 1 }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteUser(user.id)}
                      color="error"
                    >
                      Delete
                    </Button>
                    {user.status === 'INACTIVE' && (
                      <Button
                        size="small"
                        onClick={() => handleActivateUser(user)}
                        color="success"
                        sx={{ ml: 1 }}
                      >
                        Activate
                      </Button>
                    )}
                    {user.status === 'INACTIVE' && (
                      <Button
                        size="small"
                        onClick={() => handlePermanentDeleteUser(user)}
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        Delete Permanently
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              helperText="Minimum 8 characters with uppercase, lowercase, and numbers"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
              >
                {roles.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateUser} variant="contained" disabled={!formData.name || !formData.email || !formData.password || !formData.role}>
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <TextField
              label="Password (leave empty to keep current)"
              type="password"
              fullWidth
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              helperText="Minimum 8 characters with uppercase, lowercase, and numbers"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
              >
                {roles.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateUser} variant="contained" disabled={!formData.name || !formData.email || !formData.role}>
            Update User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
