
-- workspace_integrations table
CREATE TABLE public.workspace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'slack', 'webhook', etc.
  config jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  connected_by uuid REFERENCES auth.users(id),
  connected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, integration_type)
);

ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view integrations"
  ON public.workspace_integrations FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins can insert integrations"
  ON public.workspace_integrations FOR INSERT
  WITH CHECK (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR
    has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners and admins can update integrations"
  ON public.workspace_integrations FOR UPDATE
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR
    has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners and admins can delete integrations"
  ON public.workspace_integrations FOR DELETE
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR
    has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

-- webhooks table
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active', -- 'active', 'disabled'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view webhooks"
  ON public.webhooks FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins can insert webhooks"
  ON public.webhooks FOR INSERT
  WITH CHECK (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR
    has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners and admins can update webhooks"
  ON public.webhooks FOR UPDATE
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR
    has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners and admins can delete webhooks"
  ON public.webhooks FOR DELETE
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR
    has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

-- webhook_deliveries table
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  response_status integer,
  response_body text,
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Deliveries readable by workspace members (join through webhooks)
CREATE POLICY "Workspace members can view deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhooks w
      WHERE w.id = webhook_deliveries.webhook_id
      AND is_workspace_member(w.workspace_id, auth.uid())
    )
  );
