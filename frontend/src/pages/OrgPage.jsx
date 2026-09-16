import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { toast } from 'sonner';
import { ArrowLeft, FolderKanban, Plus, UserPlus, MoreHorizontal, Users } from 'lucide-react';
import { useOrg, useMembers, useChangeRole, useRemoveMember } from '@/api/orgs';
import { useProjects } from '@/api/projects';
import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { formatDate } from '@/lib/utils';
import { ROLES } from '@/lib/constants';
import { AppLayout } from '@/components/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { CardGridSkeleton, TableSkeleton } from '@/components/Skeletons';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { InviteMemberDialog } from '@/components/InviteMemberDialog';
import { RoleBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

function MembersTab({ orgId, canManage }) {
  const members = useMembers(orgId);
  const changeRole = useChangeRole(orgId);
  const removeMember = useRemoveMember(orgId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [inviteOpen, setInviteOpen] = useState(false);

  const onChangeRole = async (userId, role) => {
    try {
      await changeRole.mutateAsync({ userId, role });
      toast.success('Role updated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const onRemove = async (userId, email) => {
    try {
      await removeMember.mutateAsync(userId);
      toast.success(`Removed ${email}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (members.isLoading) return <TableSkeleton rows={4} />;

  const rows = members.data?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members.data?.meta?.total ?? rows.length} member
          {(members.data?.meta?.total ?? rows.length) === 1 ? '' : 's'}
        </p>
        {canManage && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Joined</th>
              {canManage && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.userId} className="border-t">
                <td className="px-4 py-2 font-medium">
                  {m.name}
                  {m.userId === currentUserId && (
                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                  )}
                </td>
                <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">{m.email}</td>
                <td className="px-4 py-2">
                  <RoleBadge role={m.role} />
                </td>
                <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
                  {formatDate(m.joinedAt)}
                </td>
                {canManage && (
                  <td className="px-4 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Change role</DropdownMenuLabel>
                        {ROLES.filter((r) => r !== m.role).map((r) => (
                          <DropdownMenuItem key={r} onClick={() => onChangeRole(m.userId, r)}>
                            Make {r}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onRemove(m.userId, m.email)}
                        >
                          Remove from org
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteMemberDialog orgId={orgId} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function ProjectsTab({ orgId }) {
  const projects = useProjects(orgId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {projects.data?.length ?? 0} project{projects.data?.length === 1 ? '' : 's'}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New project
        </Button>
      </div>

      {projects.isLoading ? (
        <CardGridSkeleton />
      ) : projects.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to start tracking tasks with your team."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create project
            </Button>
          }
        />
      )}

      <CreateProjectDialog orgId={orgId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export function OrgPage() {
  const { orgId } = useParams({ from: '/orgs/$orgId' });
  const org = useOrg(orgId);
  const members = useMembers(orgId);
  const canManage = org.data?.role === 'OWNER' || org.data?.role === 'ADMIN';

  return (
    <AppLayout>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All organizations
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{org.data?.name ?? 'Organization'}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {members.data?.meta?.total ?? '…'}{' '}
            {members.data?.meta?.total === 1 ? 'member' : 'members'}
          </p>
        </div>
        {org.data?.role && <RoleBadge role={org.data.role} />}
      </div>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <TabsContent value="projects">
          <ProjectsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab orgId={orgId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
