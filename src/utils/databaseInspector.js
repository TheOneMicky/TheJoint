import { supabase } from '../lib/supabase'

export async function inspectDatabase() {
  const schema = {}
  
  try {
    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')

    if (tablesError) {
      console.error('Error fetching tables:', tablesError)
      return { error: tablesError }
    }

    console.log('=== SUPABASE DATABASE SCHEMA ===')
    console.log('Tables found:', tables?.length || 0)

    // For each table, get its columns
    for (const table of tables) {
      const tableName = table.table_name
      console.log(`\n--- Table: ${tableName} ---`)
      
      try {
        // Get table columns
        const { data: columns, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select(`
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          `)
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position')

        if (columnsError) {
          console.error(`Error fetching columns for ${tableName}:`, columnsError)
          continue
        }

        schema[tableName] = {
          columns: columns || [],
          sampleData: null
        }

        // Display columns
        columns?.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : ''
          const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : ''
          console.log(`  ${col.column_name}: ${col.data_type}${maxLength} ${nullable}${defaultVal}`)
        })

        // Try to get sample data (first 3 rows)
        try {
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(3)

          if (sampleError) {
            console.log(`  Sample data: Not accessible (${sampleError.message})`)
          } else {
            console.log(`  Sample data (${sampleData.length} rows):`, sampleData)
            schema[tableName].sampleData = sampleData
          }
        } catch (sampleErr) {
          console.log(`  Sample data: Not accessible`)
        }

      } catch (err) {
        console.error(`Error processing table ${tableName}:`, err)
      }
    }

    // Check for RLS policies
    console.log('\n=== ROW LEVEL SECURITY POLICIES ===')
    try {
      const { data: policies, error: policiesError } = await supabase
        .from('pg_policies')
        .select(`
          policyname,
          tablename,
          permissive,
          roles,
          cmd,
          qual
        `)
        .eq('schemaname', 'public')

      if (policiesError) {
        console.log('RLS policies: Not accessible')
      } else {
        policies?.forEach(policy => {
          console.log(`\nPolicy: ${policy.policyname}`)
          console.log(`  Table: ${policy.tablename}`)
          console.log(`  Command: ${policy.cmd}`)
          console.log(`  Roles: ${policy.roles}`)
          console.log(`  Permissive: ${policy.permissive}`)
        })
      }
    } catch (err) {
      console.log('RLS policies: Not accessible')
    }

    // Check for functions
    console.log('\n=== CUSTOM FUNCTIONS ===')
    try {
      const { data: functions, error: functionsError } = await supabase
        .from('information_schema.routines')
        .select(`
          routine_name,
          routine_type,
          data_type,
          routine_definition
        `)
        .eq('routine_schema', 'public')

      if (functionsError) {
        console.log('Custom functions: Not accessible')
      } else {
        functions?.forEach(func => {
          console.log(`\nFunction: ${func.routine_name}`)
          console.log(`  Type: ${func.routine_type}`)
          console.log(`  Returns: ${func.data_type}`)
        })
      }
    } catch (err) {
      console.log('Custom functions: Not accessible')
    }

    return { schema, success: true }

  } catch (error) {
    console.error('Database inspection failed:', error)
    return { error }
  }
}

// Function to run in browser console
export async function runInspection() {
  console.log('Starting database inspection...')
  const result = await inspectDatabase()
  return result
}
