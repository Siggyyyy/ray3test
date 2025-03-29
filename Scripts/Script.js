// Collapsible Panels
function togglePanel(panelId) {
    const panel = document.querySelector(`.${panelId}`);
    const toggleButton = panel.querySelector('.toggle-btn');

    panel.classList.toggle('collapsed');

    toggleButton.classList.toggle('active');

    const map = document.querySelector('.map');
    if (panelId === 'item-1') {
        map.classList.toggle('expanded-left');
    } else if (panelId === 'item-3') {
        map.classList.toggle('expanded-right');
    }

    resizeMap();
}

//function to handle map resizing
function resizeMap() {
    setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(map.getBounds());
    }, 300);
}
