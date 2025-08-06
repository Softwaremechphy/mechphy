import { useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useRouter } from "next/router";
import axios from "axios";
import "../styles/resource-allocation.css";

const MAX_SOLDIERS = 14;
const ROLES = ["Assault", "Sniper", "Medic", "Engineer"];
const WEAPONS = ["Rifle", "Shotgun", "Pistol", "Sniper Rifle"];
const PROTECTIONS = ["Type 1", "Type 2", "Type 3"];
const EQUIPMENT = ["Radio", "Medical_Kit", "Communication", "Miscellaneous"];
const BASE_URL = "http://localhost:8000"; // Make sure your backend is running on this port

const createEmptySoldier = () => ({
  id: Date.now() + Math.random(), // More unique ID
  name: "",
  soldier_id: "",
  weapon_id: "",
  vest_id: "",
  role: "",
  weapon: "",
  protection: "",
  equipment: ""
});

export default function ResourceAllocation() {
  const router = useRouter();
  const { setResourceAllocation } = useGlobalContext();
  const [teams, setTeams] = useState([
    { force: "Blue_Force", teamName: "Alpha", soldiers: [createEmptySoldier()] },
    { force: "Blue_Force", teamName: "Bravo", soldiers: [createEmptySoldier()] },
    { force: "Red_Force", teamName: "Alpha", soldiers: [createEmptySoldier()] },
    { force: "Red_Force", teamName: "Bravo", soldiers: [createEmptySoldier()] },
  ]);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const renderSoldier = (teamIndex, soldier) => {
    const teamName = teams[teamIndex].teamName;
    
    return (
      <div className="soldier" key={soldier.id}>
        <select
          value={soldier.name}
          onChange={(e) => {
            const updatedTeams = [...teams];
            const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
            updateSoldier(teamIndex, soldierIndex, "name", e.target.value);
          }}
        >
          <option value="">Select Soldier</option>
          {Array.from({ length: MAX_SOLDIERS }, (_, i) => (
            <option key={i} value={`${teamName}_${i + 1}`}>
              {`${teamName.toUpperCase()} ${i + 1}`}
            </option>
          ))}
        </select>
        <div className="soldier-details">
          <input
            type="text"
            placeholder="Soldier ID"
            value={soldier.soldier_id}
            onChange={(e) => {
              const updatedTeams = [...teams];
              const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
              updateSoldier(teamIndex, soldierIndex, "soldier_id", e.target.value);
            }}
          />
          <input
            type="text"
            placeholder="Weapon ID"
            value={soldier.weapon_id}
            onChange={(e) => {
              const updatedTeams = [...teams];
              const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
              updateSoldier(teamIndex, soldierIndex, "weapon_id", e.target.value);
            }}
          />
          <input
            type="text"
            placeholder="Vest ID"
            value={soldier.vest_id}
            onChange={(e) => {
              const updatedTeams = [...teams];
              const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
              updateSoldier(teamIndex, soldierIndex, "vest_id", e.target.value);
            }}
          />
        </div>
        <div className="soldier-details">
          <select
            value={soldier.role}
            onChange={(e) => {
              const updatedTeams = [...teams];
              const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
              updateSoldier(teamIndex, soldierIndex, "role", e.target.value);
            }}
          >
            <option value="">Designated Role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={soldier.weapon}
            onChange={(e) => {
              const updatedTeams = [...teams];
              const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
              updateSoldier(teamIndex, soldierIndex, "weapon", e.target.value);
            }}
          >
            <option value="">Weapon</option>
            {WEAPONS.map((weapon) => (
              <option key={weapon} value={weapon}>
                {weapon}
              </option>
            ))}
          </select>
          <select
            value={soldier.protection}
            onChange={(e) => {
              const updatedTeams = [...teams];
              const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
              updateSoldier(teamIndex, soldierIndex, "protection", e.target.value);
            }}
          >
            <option value="">Ballistic Protection</option>
            {PROTECTIONS.map((protection) => (
              <option key={protection} value={protection}>
                {protection}
              </option>
            ))}
          </select>
          <select
            value={soldier.equipment}
            onChange={(e) => {
              const updatedTeams = [...teams];
              const soldierIndex = updatedTeams[teamIndex].soldiers.findIndex(s => s.id === soldier.id);
              updateSoldier(teamIndex, soldierIndex, "equipment", e.target.value);
            }}
          >
            <option value="">Additional Equipment</option>
            {EQUIPMENT.map((equip) => (
              <option key={equip} value={equip}>
                {equip}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const updateTeamProperty = (teamIndex, property, value) => {
    const updatedTeams = [...teams];
    updatedTeams[teamIndex][property] = value;
    setTeams(updatedTeams);
  };

  const updateSoldier = (teamIndex, soldierIndex, field, value) => {
    const updatedTeams = [...teams];
    updatedTeams[teamIndex].soldiers[soldierIndex] = {
      ...updatedTeams[teamIndex].soldiers[soldierIndex],
      [field]: value,
    };
    setTeams(updatedTeams);
  };

  const addSoldier = (teamIndex) => {
    const updatedTeams = [...teams];
    if (updatedTeams[teamIndex].soldiers.length < MAX_SOLDIERS) {
      const newSoldier = createEmptySoldier();
      updatedTeams[teamIndex].soldiers.push(newSoldier);
      setTeams(updatedTeams);
    }
  };

  const handleSaveAndContinue = () => {
    const validTeams = teams.map(team => ({
      ...team,
      soldiers: team.soldiers.filter(soldier => 
        soldier.soldier_id && soldier.weapon_id && soldier.vest_id && soldier.role
      )
    }));
    setPreviewData(validTeams);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate that we have valid soldiers
      const validSoldiers = teams
        .flatMap(team => team.soldiers)
        .filter(soldier => soldier.soldier_id && soldier.weapon_id && soldier.vest_id && soldier.role);

      if (validSoldiers.length === 0) {
        throw new Error("No valid soldiers found. Please ensure all required fields are filled.");
      }

      // Step 1: Create Session with correct payload structure
      const sessionId = `session_${Date.now()}`;
      
      console.log('Creating session with ID:', sessionId);

      const sessionPayload = {
        session_id: sessionId
      };

      const sessionResponse = await axios.post(`${BASE_URL}/api/sessions/`, sessionPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      console.log('Session created:', sessionResponse.data);
      
      // Use the session ID returned by the server, not the one we sent
      const actualSessionId = sessionResponse.data.session_id;

      // Step 2: Only create soldiers (weapons and vests must already exist in the database)
      console.log('Creating soldiers...');
      console.log('Note: Weapons and vests must already exist in the database');
      
      for (const soldier of validSoldiers) {
        try {
          const soldierPayload = {
            soldier_id: soldier.soldier_id,
            call_sign: soldier.name || `Soldier_${soldier.soldier_id}`,
            stats: {
              kill_count: 0,
              sessions_participated: [],
              stats_data: {}
            }
          };
          
          await axios.post(`${BASE_URL}/api/soldiers/`, soldierPayload, {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });
          
          console.log(`Created soldier ${soldier.soldier_id}`);
        } catch (err) {
          // If soldier already exists, that's fine
          if (err.response?.status === 409 || err.response?.status === 400) {
            console.log(`Soldier ${soldier.soldier_id} already exists or validation error`);
          } else {
            console.error(`Error creating soldier ${soldier.soldier_id}:`, err.response?.data);
          }
        }
      }

      // Step 3: Proceed with allocation (weapons and vests must exist in database)
      for (const soldier of validSoldiers) {
        try {
          const soldierPayload = {
            soldier_id: soldier.soldier_id,
            call_sign: soldier.name || `Soldier_${soldier.soldier_id}`,
            stats: {
              kill_count: 0,
              sessions_participated: [],
              stats_data: {}
            }
          };
          
          await axios.post(`${BASE_URL}/api/soldiers`, soldierPayload, {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });
          
          console.log(`Created soldier ${soldier.soldier_id}`);
        } catch (err) {
          // If soldier already exists, that's fine
          if (err.response?.status === 409) {
            console.log(`Soldier ${soldier.soldier_id} already exists`);
          } else {
            console.error(`Error creating soldier ${soldier.soldier_id}:`, err.response?.data);
          }
        }
      }

      // Step 3: Allocate Resources using the correct endpoint
      // Based on the API docs, we need to use PUT /api/sessions/{session_id}/allocate

      // Group soldiers by team and create the structure expected by the API
      const teamGroups = {
        Blue_Force: [],
        Red_Force: []
      };

      // Find which team each soldier belongs to
      validSoldiers.forEach(soldier => {
        const team = teams.find(t => t.soldiers.some(s => s.soldier_id === soldier.soldier_id));
        if (team) {
          console.log(`Soldier ${soldier.soldier_id} belongs to team ${team.force}`);
          
          // Map equipment to API format
          let equipmentValue = soldier.equipment || "Miscellaneous";
          if (equipmentValue === "Medical Kit") {
            equipmentValue = "Medical_Kit";
          } else if (equipmentValue === "Communicational") {
            equipmentValue = "Communication";
          }
          
          teamGroups[team.force].push({
            soldier_id: soldier.soldier_id,
            weapon_id: soldier.weapon_id,
            vest_id: soldier.vest_id,
            role: soldier.role,
            equipment: equipmentValue
          });
        } else {
          console.log(`Could not find team for soldier ${soldier.soldier_id}`);
        }
      });

      console.log('Team groups:', teamGroups);

      // Create the exact structure as per API docs
      // Both teams must be present with all squads defined
      const allocationPayload = {
        team_blue: {
          squad_1: { soldiers: [] },
          squad_2: { soldiers: [] },
          squad_3: { soldiers: [] },
          squad_4: { soldiers: [] },
          squad_5: { soldiers: [] },
          squad_6: { soldiers: [] }
        },
        team_red: {
          squad_1: { soldiers: [] },
          squad_2: { soldiers: [] },
          squad_3: { soldiers: [] },
          squad_4: { soldiers: [] },
          squad_5: { soldiers: [] },
          squad_6: { soldiers: [] }
        }
      };
      
      // Populate the squads with soldiers
      if (teamGroups.Blue_Force.length > 0) {
        allocationPayload.team_blue.squad_1.soldiers = teamGroups.Blue_Force;
      }

      if (teamGroups.Red_Force.length > 0) {
        allocationPayload.team_red.squad_1.soldiers = teamGroups.Red_Force;
      }

      console.log('Allocating resources:', JSON.stringify(allocationPayload, null, 2));

      const allocationResponse = await axios.put(`${BASE_URL}/api/sessions/${actualSessionId}/allocate`, allocationPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      console.log('Resources allocated:', allocationResponse.data);

      // Step 3: Format data for GlobalContext
      const formattedData = teams.reduce((acc, team) => {
        if (!acc[team.force]) {
          acc[team.force] = {};
        }
        
        const validTeamSoldiers = team.soldiers.filter(soldier => 
          soldier.soldier_id && soldier.weapon_id && soldier.vest_id && soldier.role
        );
        
        if (validTeamSoldiers.length > 0) {
          acc[team.force][team.teamName] = {
            soldiers: validTeamSoldiers.map(soldier => ({
              soldier_id: soldier.soldier_id,
              weapon_id: soldier.weapon_id,
              vest_id: soldier.vest_id,
              role: soldier.role,
              equipment: soldier.equipment || "Unknown"
            })),
            session_id: actualSessionId
          };
        }
        
        return acc;
      }, {});

      console.log('Formatted data for context:', formattedData);

      // Step 4: Store in GlobalContext and navigate
      setResourceAllocation(formattedData);
      router.push("/synchronization");

    } catch (err) {
      console.error('Error in handleConfirm:', err);
      
      if (err.code === 'ECONNREFUSED') {
        setError("Cannot connect to the backend server. Please ensure the server is running on http://localhost:8000");
      } else if (err.response) {
        // Server responded with error status
        console.error('Error response:', err.response);
        console.error('Error response data:', err.response.data);
        console.error('Error detail:', JSON.stringify(err.response.data.detail, null, 2));
        const errorMessage = err.response.data?.detail || err.response.data?.message || err.response.statusText;
        setError(`Server error (${err.response.status}): ${JSON.stringify(errorMessage, null, 2)}`);
      } else if (err.request) {
        // Request was made but no response received
        setError("No response from server. Please check if the backend is running.");
      } else {
        // Something else happened
        setError(err.message || "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Resource Allocation</h1>

      {error && (
        <div className="error" style={{ 
          color: "red", 
          backgroundColor: "#ffebee", 
          padding: "10px", 
          borderRadius: "4px",
          marginBottom: "20px"
        }}>
          {error}
        </div>
      )}
      
      {loading && (
        <div className="loading" style={{ 
          color: "blue", 
          backgroundColor: "#e3f2fd", 
          padding: "10px", 
          borderRadius: "4px",
          marginBottom: "20px"
        }}>
          Processing...
        </div>
      )}

      {!previewData && (
        <div id="teams">
          {teams.map((team, teamIndex) => (
            <div key={teamIndex} className="team">
              <div className="select-row">
                <select
                  value={team.force}
                  onChange={(e) =>
                    updateTeamProperty(teamIndex, "force", e.target.value)
                  }
                >
                  <option value="Blue_Force">Blue Force</option>
                  <option value="Red_Force">Red Force</option>
                </select>
                <select
                  value={team.teamName}
                  onChange={(e) =>
                    updateTeamProperty(teamIndex, "teamName", e.target.value)
                  }
                >
                  <option value="Alpha">Alpha</option>
                  <option value="Bravo">Bravo</option>
                </select>
              </div>
              <h2>{`${team.force.replace("_", " ")} - ${team.teamName} Team`}</h2>
              <div className="progress-bar">
                <div
                  className="progress"
                  style={{
                    width: `${(team.soldiers.length / MAX_SOLDIERS) * 100}%`,
                  }}
                ></div>
              </div>
              <p>Soldiers added: {team.soldiers.length} / {MAX_SOLDIERS}</p>
              {team.soldiers.map((soldier) =>
                renderSoldier(teamIndex, soldier)
              )}
              {team.soldiers.length < MAX_SOLDIERS && (
                <button onClick={() => addSoldier(teamIndex)}>Add Soldier</button>
              )}
            </div>
          ))}
          <button
            className="save-button"
            onClick={handleSaveAndContinue}
            disabled={loading}
          >
            Save and Continue
          </button>
        </div>
      )}

      {previewData && (
        <div id="preview">
          <h2>Preview</h2>
          <table>
            <thead>
              <tr>
                <th>Force</th>
                <th>Team</th>
                <th>Soldier ID</th>
                <th>Weapon ID</th>
                <th>Vest ID</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {previewData.map((team, teamIndex) =>
                team.soldiers.map((soldier, soldierIndex) => (
                  <tr key={`${teamIndex}-${soldierIndex}`}>
                    <td>{team.force.replace("_", " ")}</td>
                    <td>{team.teamName}</td>
                    <td>{soldier.soldier_id}</td>
                    <td>{soldier.weapon_id}</td>
                    <td>{soldier.vest_id}</td>
                    <td>{soldier.role}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <button onClick={() => setPreviewData(null)} disabled={loading}>
            Edit
          </button>
          <button onClick={handleConfirm} disabled={loading}>
            {loading ? "Processing..." : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}                                                                                                                                                                                                   