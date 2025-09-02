import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

const AppModeTestingPanel = ({ onComplete }) => {
  const [config, setConfig] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('current');
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const result = await window.electron.appMode.loadConfig();
      setConfig(result);
      setOverrides(result.testingOverrides);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const runModeDetection = async (scenario = 'current') => {
    setIsRunningTest(true);
    setTestResult(null);
    
    try {
      const result = await window.electron.appMode.runDetection({
        scenario,
        overrides: scenario === 'current' ? overrides : null
      });
      setTestResult(result);
    } catch (error) {
      console.error('Mode detection failed:', error);
      setTestResult({
        error: 'Detection failed',
        details: error.message
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleOverrideChange = (key, value) => {
    setOverrides(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'SCAN': return 'bg-green-500 text-white';
      case 'UNSCAN': return 'bg-yellow-500 text-white';
      case 'HYBRID': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const proceedToApp = () => {
    if (onComplete) {
      onComplete(testResult);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 CypherEdge App Mode Testing Panel
          </h1>
          <p className="text-gray-600">
            Development mode detected - Test app mode detection before proceeding
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Testing Controls */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎯 Mode Detection Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scenario Selection */}
              <div>
                <h3 className="font-semibold mb-3">Test Scenarios</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(config.testing.scenarios).map(([key, scenario]) => (
                    <Button
                      key={key}
                      variant={selectedScenario === key ? "default" : "outline"}
                      onClick={() => {
                        setSelectedScenario(key);
                        runModeDetection(key);
                      }}
                      disabled={isRunningTest}
                      className="text-left justify-start"
                    >
                      <div>
                        <div className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                        <div className="text-xs opacity-70">
                          {scenario.ram}GB RAM, {scenario.cpu}
                        </div>
                      </div>
                    </Button>
                  ))}
                  <Button
                    variant={selectedScenario === 'current' ? "default" : "outline"}
                    onClick={() => {
                      setSelectedScenario('current');
                      runModeDetection('current');
                    }}
                    disabled={isRunningTest}
                    className="text-left justify-start"
                  >
                    <div>
                      <div className="font-medium">Current System</div>
                      <div className="text-xs opacity-70">
                        With overrides
                      </div>
                    </div>
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Override Controls */}
              {selectedScenario === 'current' && (
                <div>
                  <h3 className="font-semibold mb-3">Testing Overrides</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Force RAM (GB)</label>
                      <input
                        type="number"
                        value={overrides.forceRAM || ''}
                        onChange={(e) => handleOverrideChange('forceRAM', parseInt(e.target.value) || null)}
                        className="w-full p-2 border rounded-md"
                        placeholder="Auto-detect"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Force CPU</label>
                      <select
                        value={overrides.forceCPU || ''}
                        onChange={(e) => handleOverrideChange('forceCPU', e.target.value || null)}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="">Auto-detect</option>
                        <option value="i3">Intel i3</option>
                        <option value="i5">Intel i5</option>
                        <option value="i7">Intel i7</option>
                        <option value="i9">Intel i9</option>
                        <option value="ryzen3">AMD Ryzen 3</option>
                        <option value="ryzen5">AMD Ryzen 5</option>
                        <option value="ryzen7">AMD Ryzen 7</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Force Scan Result</label>
                      <select
                        value={overrides.forceScanResult || ''}
                        onChange={(e) => handleOverrideChange('forceScanResult', e.target.value || null)}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="">Run actual test</option>
                        <option value="pass">Force Pass</option>
                        <option value="fail">Force Fail</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Simulate Slow Scan</label>
                      <input
                        type="checkbox"
                        checked={overrides.simulateSlowScan || false}
                        onChange={(e) => handleOverrideChange('simulateSlowScan', e.target.checked)}
                        className="ml-2"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Run Test Button */}
              <Button
                onClick={() => runModeDetection(selectedScenario)}
                disabled={isRunningTest}
                className="w-full"
                size="lg"
              >
                {isRunningTest ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running Detection...
                  </>
                ) : (
                  `🚀 Run ${selectedScenario === 'current' ? 'Current System' : selectedScenario} Test`
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!testResult && (
                <div className="text-center py-8 text-gray-500">
                  Run a test to see results
                </div>
              )}

              {testResult && testResult.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="font-semibold text-red-800">Error</div>
                  <div className="text-red-600 text-sm mt-1">{testResult.details}</div>
                </div>
              )}

              {testResult && !testResult.error && (
                <div className="space-y-4">
                  {/* Mode Result */}
                  <div className="text-center">
                    <Badge className={`text-lg px-4 py-2 ${getModeColor(testResult.mode)}`}>
                      {testResult.mode} MODE
                    </Badge>
                  </div>

                  {/* System Specs */}
                  {testResult.systemSpecs && (
                    <div>
                      <h4 className="font-semibold mb-2">System Specs</h4>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div>RAM: {testResult.systemSpecs.ram}GB</div>
                        <div>CPU: {testResult.systemSpecs.cpu}</div>
                        {testResult.systemSpecs.scanTime && (
                          <div>Scan Time: {testResult.systemSpecs.scanTime}ms</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Decision Logic */}
                  {testResult.reasoning && (
                    <div>
                      <h4 className="font-semibold mb-2">Decision Logic</h4>
                      <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                        {testResult.reasoning}
                      </div>
                    </div>
                  )}

                  {/* Storage Path */}
                  {testResult.storagePath && (
                    <div>
                      <h4 className="font-semibold mb-2">Saved To</h4>
                      <div className="bg-green-50 rounded-lg p-3 text-xs text-green-800 font-mono">
                        {testResult.storagePath}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            🔄 Reset Testing
          </Button>
          
          <Button
            onClick={proceedToApp}
            size="lg"
            disabled={!testResult || testResult.error}
          >
            ✅ Proceed to CypherEdge
          </Button>
        </div>

        {/* Configuration Display */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>⚙️ Configuration Values</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Full Mode Requirements</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div>Min RAM: {config.hardwareThresholds.fullMode.minRAM}GB</div>
                  <div>Min CPU: {config.hardwareThresholds.fullMode.minProcessor}</div>
                  <div>Scan Timeout: {config.hardwareThresholds.fullMode.scanTestTimeout}ms</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Hybrid Mode Triggers</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div>Max RAM: {config.hardwareThresholds.hybridMode.maxRAM}GB</div>
                  <div>Max CPU: {config.hardwareThresholds.hybridMode.maxProcessor}</div>
                  <div>Low-end CPUs: {config.hardwareThresholds.hybridMode.lowEndProcessors.join(', ')}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppModeTestingPanel;