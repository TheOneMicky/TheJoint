import { useState, useEffect } from 'react'
import { inspectDatabase } from '../utils/databaseInspector'
import { Database, Eye, EyeOff, RefreshCw } from 'lucide-react'

export default function DatabaseInspector() {
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSampleData, setShowSampleData] = useState({})

  const handleInspect = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await inspectDatabase()
      if (result.success) {
        setSchema(result.schema)
      } else {
        setError(result.error?.message || 'Inspection failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSampleData = (tableName) => {
    setShowSampleData(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Database className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Supabase Database Inspector</h1>
            </div>
            <button
              onClick={handleInspect}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Inspecting...' : 'Inspect Database'}</span>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <strong>Error:</strong> {error}
            </div>
          )}

          {schema && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">
                  Database Schema Overview
                </h2>
                <p className="text-blue-800">
                  Found {Object.keys(schema).length} tables in public schema
                </p>
              </div>

              {Object.entries(schema).map(([tableName, tableInfo]) => (
                <div key={tableName} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        📋 {tableName}
                      </h3>
                      {tableInfo.sampleData && (
                        <button
                          onClick={() => toggleSampleData(tableName)}
                          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          {showSampleData[tableName] ? (
                            <><EyeOff className="w-4 h-4" /><span>Hide Data</span></>
                          ) : (
                            <><Eye className="w-4 h-4" /><span>Show Sample Data</span></>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Columns:</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Column</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nullable</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {tableInfo.columns.map((col, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{col.column_name}</td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {col.data_type}
                                  {col.character_maximum_length && `(${col.character_maximum_length})`}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    col.is_nullable === 'YES' 
                                      ? 'bg-yellow-100 text-yellow-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                                  {col.column_default || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {showSampleData[tableName] && tableInfo.sampleData && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Data:</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                {Object.keys(tableInfo.sampleData[0] || {}).map(key => (
                                  <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {tableInfo.sampleData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  {Object.values(row).map((value, valIdx) => (
                                    <td key={valIdx} className="px-4 py-2 text-sm text-gray-600">
                                      {value === null ? (
                                        <span className="text-gray-400 italic">NULL</span>
                                      ) : typeof value === 'object' ? (
                                        <span className="text-blue-600">[Object]</span>
                                      ) : (
                                        String(value)
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
