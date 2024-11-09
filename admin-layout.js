// admin-layout.js

// Add this to the top of each page's JavaScript files
async function checkAuth() {
    const sessionToken = localStorage.getItem('sessionToken');
    const teacherId = localStorage.getItem('teacherId');

    if (!sessionToken || !teacherId) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const { data: session, error } = await window.supabase
            .from('active_sessions')
            .select('expires_at')
            .eq('session_token', sessionToken)
            .eq('teacher_id', teacherId)
            .single();

        if (error || !session || new Date(session.expires_at) <= new Date()) {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('teacherId');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'login.html';
    }
}

async function handleLogout() {
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
        try {
            // Remove session from database
            await window.supabase
                .from('active_sessions')
                .delete()
                .eq('session_token', sessionToken);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    // Clear all local storage
    localStorage.clear();
    
    // Redirect to login page
    window.location.href = 'login.html';
}

function initializeLayout() {
    // Add active class to current page link
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        if (item.getAttribute('href') === currentPage) {
            item.classList.add('active');
        }
    });

    // Add logout button initialization
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleLogout();
        });
    }

    // Handle responsive menu for mobile
    const handleResize = () => {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        // Only proceed if both elements exist
        if (sidebar && mainContent) {
            let sidebarWidth = '250px';
            let contentMargin = '250px';

            if (window.innerWidth <= 576) {
                // Mobile view
                sidebarWidth = '60px';
                contentMargin = '60px';
            } else if (window.innerWidth <= 768) {
                // Tablet view
                sidebarWidth = '200px';
                contentMargin = '200px';
            }

            sidebar.style.width = sidebarWidth;
            mainContent.style.marginLeft = contentMargin;
            mainContent.style.width = `calc(100% - ${contentMargin})`;
        }
    };

    // Only add resize listener if the required elements exist
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar && mainContent) {
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call
    }
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuth(true);  // true means this page requires admin access
});

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLayout);
} else {
    initializeLayout();
}