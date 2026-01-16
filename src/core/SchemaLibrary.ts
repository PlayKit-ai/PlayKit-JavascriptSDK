/**
 * Schema Library for managing JSON schemas for AI structured output generation
 * This allows developers to manage all schemas in one place
 */

/**
 * Schema entry definition
 */
export interface SchemaEntry {
  /** Unique name for the schema */
  name: string;
  /** Description of what this schema represents */
  description: string;
  /** JSON Schema definition */
  schema: Record<string, any>;
}

/**
 * Schema Library for structured output generation
 * Manages a collection of JSON schemas that can be used with AI text generation
 */
export class SchemaLibrary {
  private schemas: Map<string, SchemaEntry> = new Map();

  constructor(initialSchemas?: SchemaEntry[]) {
    if (initialSchemas) {
      for (const entry of initialSchemas) {
        this.addSchema(entry);
      }
    }
  }

  /**
   * Add a new schema to the library
   * @param entry The schema entry to add
   * @throws Error if schema name is empty or already exists
   */
  addSchema(entry: SchemaEntry): void {
    if (!entry.name) {
      throw new Error('[SchemaLibrary] Schema name cannot be empty');
    }

    if (!entry.schema) {
      throw new Error(`[SchemaLibrary] Schema '${entry.name}' must have a schema definition`);
    }

    if (this.schemas.has(entry.name)) {
      console.warn(`[SchemaLibrary] Schema '${entry.name}' already exists, overwriting`);
    }

    // Validate JSON schema structure
    if (!this.isValidSchema(entry.schema)) {
      throw new Error(`[SchemaLibrary] Schema '${entry.name}' has invalid JSON schema structure`);
    }

    this.schemas.set(entry.name, { ...entry });
  }

  /**
   * Get a schema by name
   * @param name Name of the schema to retrieve
   * @returns The schema entry, or undefined if not found
   */
  getSchema(name: string): SchemaEntry | undefined {
    return this.schemas.get(name);
  }

  /**
   * Get the JSON schema object for a given schema name
   * @param name Name of the schema
   * @returns JSON schema object or undefined if not found
   */
  getSchemaJson(name: string): Record<string, any> | undefined {
    return this.schemas.get(name)?.schema;
  }

  /**
   * Check if a schema exists
   * @param name Name of the schema to check
   * @returns True if schema exists
   */
  hasSchema(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Get all schema names
   * @returns Array of schema names
   */
  getSchemaNames(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get all schema entries
   * @returns Array of all schema entries
   */
  getAllSchemas(): SchemaEntry[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Remove a schema by name
   * @param name Name of the schema to remove
   * @returns True if removed, false if not found
   */
  removeSchema(name: string): boolean {
    return this.schemas.delete(name);
  }

  /**
   * Clear all schemas
   */
  clear(): void {
    this.schemas.clear();
  }

  /**
   * Get the number of schemas in the library
   */
  get size(): number {
    return this.schemas.size;
  }

  /**
   * Basic validation of JSON schema structure
   */
  private isValidSchema(schema: Record<string, any>): boolean {
    // Must have a type or be an object with properties
    if (!schema.type && !schema.properties && !schema.$ref) {
      return false;
    }
    return true;
  }

  /**
   * Create a schema entry from a simple object type definition
   * Helper method for quick schema creation
   */
  static createObjectSchema(
    name: string,
    description: string,
    properties: Record<string, { type: string; description?: string; enum?: string[]; required?: boolean }>,
    additionalProperties: boolean = false
  ): SchemaEntry {
    const schemaProperties: Record<string, any> = {};
    const required: string[] = [];

    for (const [propName, propDef] of Object.entries(properties)) {
      const prop: Record<string, any> = { type: propDef.type };
      
      if (propDef.description) {
        prop.description = propDef.description;
      }
      
      if (propDef.enum) {
        prop.enum = propDef.enum;
      }

      schemaProperties[propName] = prop;

      if (propDef.required !== false) {
        required.push(propName);
      }
    }

    return {
      name,
      description,
      schema: {
        type: 'object',
        properties: schemaProperties,
        required,
        additionalProperties,
      },
    };
  }

  /**
   * Create a schema entry for an array of objects
   */
  static createArraySchema(
    name: string,
    description: string,
    itemSchema: Record<string, any>
  ): SchemaEntry {
    return {
      name,
      description,
      schema: {
        type: 'array',
        items: itemSchema,
      },
    };
  }

  /**
   * Create a schema entry for an enum (string with fixed values)
   */
  static createEnumSchema(
    name: string,
    description: string,
    values: string[]
  ): SchemaEntry {
    return {
      name,
      description,
      schema: {
        type: 'string',
        enum: values,
      },
    };
  }

  /**
   * Export all schemas to JSON
   */
  toJSON(): Record<string, SchemaEntry> {
    const result: Record<string, SchemaEntry> = {};
    for (const [name, entry] of this.schemas) {
      result[name] = entry;
    }
    return result;
  }

  /**
   * Import schemas from JSON
   */
  fromJSON(data: Record<string, SchemaEntry>): void {
    for (const [name, entry] of Object.entries(data)) {
      this.addSchema({ ...entry, name });
    }
  }
}

/**
 * Default schema library instance
 * Can be used as a global schema registry
 */
export const defaultSchemaLibrary = new SchemaLibrary();

