
const renderMissionCards = (missions) => {
  const container = document.getElementById("mission-list");
  if (!container) return;

  container.innerHTML = missions.map(m => `
    <div class="mission-card">
      <h3>${m.name}</h3>
      
    </div>
  `).join('');
};

