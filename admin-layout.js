// admin-layout.js
function initializeLayout() {
    // Add active class to current page link
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        if (item.getAttribute('href') === currentPage) {
            item.classList.add('active');
        }
    });

    // Handle responsive menu for mobile
    const handleResize = () => {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (window.innerWidth <= 576) {
            // Mobile view
            sidebar.style.width = '60px';
            mainContent.style.marginLeft = '60px';
            mainContent.style.width = 'calc(100% - 60px)';
        } else if (window.innerWidth <= 768) {
            // Tablet view
            sidebar.style.width = '200px';
            mainContent.style.marginLeft = '200px';
            mainContent.style.width = 'calc(100% - 200px)';
        } else {
            // Desktop view
            sidebar.style.width = '250px';
            mainContent.style.marginLeft = '250px';
            mainContent.style.width = 'calc(100% - 250px)';
        }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLayout);
} else {
    initializeLayout();
}