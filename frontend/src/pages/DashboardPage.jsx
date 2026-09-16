import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Building2, Plus } from 'lucide-react';
import { useOrgs } from '@/api/orgs';
import { AppLayout } from '@/components/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { CardGridSkeleton } from '@/components/Skeletons';
import { CreateOrgDialog } from '@/components/CreateOrgDialog';
import { RoleBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardPage() {
  const orgs = useOrgs();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your organizations</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New org
        </Button>
      </div>

      {orgs.isLoading ? (
        <CardGridSkeleton />
      ) : orgs.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.data.map((org) => (
            <Link key={org.id} to="/orgs/$orgId" params={{ orgId: org.id }}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div>
                        <CardTitle className="text-base">{org.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">/{org.slug}</p>
                      </div>
                    </div>
                    <RoleBadge role={org.role} />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="No organizations yet"
          description="Create your first organization to start adding projects and teammates."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create organization
            </Button>
          }
        />
      )}

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppLayout>
  );
}
