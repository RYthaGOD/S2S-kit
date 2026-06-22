document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('demo-button-container');
    const statusText = document.getElementById('status-text');

    let state = 'unsubscribed';

    const renderButton = () => {
        container.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = 's2s-btn-demo';
        
        // Add entrance animation
        btn.style.opacity = '0';
        btn.style.transform = 'translateY(10px)';
        
        if (state === 'unsubscribed') {
            btn.innerText = 'Deposit 100 jitoSOL';
            statusText.innerText = 'Ready to Initialize';
        } else if (state === 'subscribed') {
            btn.innerText = 'Access Granted';
            btn.classList.add('active');
            statusText.innerText = 'jitoSOL rate: 1.0420';
        } else if (state === 'unstaking') {
            btn.innerText = 'Unlocking Principal';
            btn.style.borderColor = '#FF3366';
            btn.style.color = '#FF3366';
            statusText.innerText = 'Cooldown: 47:59:58';
        }

        btn.onclick = () => {
            // Simple state machine for the demo
            if (state === 'unsubscribed') {
                state = 'subscribed';
            } else if (state === 'subscribed') {
                state = 'unstaking';
            } else {
                state = 'unsubscribed';
            }
            renderButton();
        };

        container.appendChild(btn);
        
        // Trigger animation
        setTimeout(() => {
            btn.style.transition = '0.4s cubic-bezier(0.23, 1, 0.32, 1)';
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0)';
        }, 10);
    };

    renderButton();
});
