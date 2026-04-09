import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { WorkspaceTab } from "@/components/settings/WorkspaceTab";
import { TeamTab } from "@/components/settings/TeamTab";
import { BillingTab } from "@/components/settings/BillingTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { ActivityTab } from "@/components/settings/ActivityTab";
import { ApiKeysTab } from "@/components/settings/ApiKeysTab";
import { WhiteLabelTab } from "@/components/settings/WhiteLabelTab";
import { ReferralsTab } from "@/components/settings/ReferralsTab";
import { useWorkspace } from "@/hooks/useWorkspace";

const Settings = () => {
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();

  const isAdminOrOwner = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";
  const isOwner = currentWorkspace?.role === "owner";

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("settings.profile")}</TabsTrigger>
          <TabsTrigger value="workspace">{t("settings.workspace")}</TabsTrigger>
          <TabsTrigger value="team">{t("settings.team")}</TabsTrigger>
          <TabsTrigger value="billing">{t("settings.billing")}</TabsTrigger>
          <TabsTrigger value="integrations">{t("integrations.title")}</TabsTrigger>
          <TabsTrigger value="activity">{t("activity.title")}</TabsTrigger>
          {isAdminOrOwner && <TabsTrigger value="api">{"API & Webhooks"}</TabsTrigger>}
          {isAdminOrOwner && <TabsTrigger value="branding">{"White-Label"}</TabsTrigger>}
          <TabsTrigger value="referrals">Referrals <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold">NEW</span></TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-4">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="workspace" className="space-y-6 mt-4">
          <WorkspaceTab />
        </TabsContent>

        <TabsContent value="team" className="space-y-6 mt-4">
          <TeamTab />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 mt-4">
          <BillingTab currentWorkspace={currentWorkspace} t={t} isOwner={isOwner} />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6 mt-4">
          <IntegrationsTab workspaceId={currentWorkspace?.id} isAdminOrOwner={isAdminOrOwner} t={t} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 mt-4">
          <ActivityTab workspaceId={currentWorkspace?.id} t={t} />
        </TabsContent>

        <TabsContent value="referrals" className="space-y-6 mt-4">
          <ReferralsTab workspaceId={currentWorkspace?.id} />
        </TabsContent>

        {isAdminOrOwner && currentWorkspace && (
          <TabsContent value="api" className="space-y-6 mt-4">
            <ApiKeysTab workspaceId={currentWorkspace.id} />
          </TabsContent>
        )}

        {isAdminOrOwner && currentWorkspace && (
          <TabsContent value="branding" className="space-y-6 mt-4">
            <WhiteLabelTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
