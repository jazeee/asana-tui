export type Resource = { gid: string; name?: string; resource_type?: string; permalink_url?: string };

export type User = Resource & { email?: string; workspaces?: Resource[] };

export type CustomField = Resource & {
  display_value?: string | null;
  type?: string;
};

export type Task = Resource & {
  completed?: boolean;
  completed_at?: string | null;
  due_on?: string | null;
  due_at?: string | null;
  start_on?: string | null;
  notes?: string;
  html_notes?: string;
  assignee?: Resource | null;
  parent?: Resource | null;
  projects?: Resource[];
  tags?: Resource[];
  followers?: Resource[];
  custom_fields?: CustomField[];
  memberships?: { project?: Resource; section?: Resource }[];
  num_subtasks?: number;
  permalink_url?: string;
  created_at?: string;
  modified_at?: string;
};

export type Story = Resource & {
  text?: string;
  type?: string;
  created_at?: string;
  created_by?: Resource | null;
};

export type Project = Resource & {
  archived?: boolean;
  public?: boolean;
  notes?: string;
  permalink_url?: string;
  team?: Resource | null;
};

export const taskListFields =
  'name,completed,due_on,due_at,assignee.name,projects.name,permalink_url,modified_at';

export const taskDetailFields = `${taskListFields},notes,start_on,completed_at,created_at,parent.name,parent.permalink_url,tags.name,followers.name,num_subtasks,custom_fields.name,custom_fields.display_value,memberships.project.name,memberships.section.name`;
