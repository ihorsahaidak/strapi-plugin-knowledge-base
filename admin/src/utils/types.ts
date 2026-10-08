export type AttributeInfo = {
  name: string;
  type: string;
  target?: string;
  relation?: string;
  component?: string;
  repeatable?: boolean;
  components?: string[];
  enum?: string[];
  multiple?: boolean;
  required?: boolean;
  localized?: boolean;
};

export type UsageRef = {
  uid: string;
  kind: 'contentType' | 'component';
  field: string;
  displayName: string;
  repeatable?: boolean;
  dynamicZone?: boolean;
};

export type ContentTypeInfo = {
  uid: string;
  kind: 'collectionType' | 'singleType';
  displayName: string;
  description: string;
  localized: boolean;
  attributes: AttributeInfo[];
};

export type ComponentInfo = {
  uid: string;
  category: string;
  displayName: string;
  icon: string;
  attributes: AttributeInfo[];
  usedIn: UsageRef[];
};

export type Schema = {
  contentTypes: ContentTypeInfo[];
  components: ComponentInfo[];
};

/** One documented node. The description is Textile (Redmine flavour); the rest is bookkeeping. */
export type Entry = {
  description?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type EntriesPayload = {
  locale: string;
  fallbackLocale: string;
  locales: string[];
  entries: Record<string, Entry>;
  fallback: Record<string, Entry>;
  canEdit: boolean;
  writable: boolean;
  dataDir: string;
};

/** What a 👀 button points at: one documentable node of the schema. */
export type Target = {
  key: string;
  kind: 'contentType' | 'component' | 'field';
  /** Human label shown as the modal's heading. */
  label: string;
  /** Where the node lives, e.g. "Page" or "shared.seo". */
  ownerLabel: string;
  ownerUid: string;
  fieldName?: string;
  attribute?: AttributeInfo;
};
