document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('demo-button-container');
    const statusText = document.getElementById('status-text');

    let state = 'unsubscribed';

    const renderButton = () => {
        container.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = 's2s-btn-demo';
        
        if (state === 'unsubscribed') {
            btn.innerText = 'Stake 100 $SKR to Subscribe';
            statusText.innerText = 'Ready to Stake';
        } else if (state === 'subscribed') {
            btn.innerText = 'Subscribed';
            btn.classList.add('active');
            statusText.innerText = 'Active Access | Earning Yield';
        } else if (state === 'unstaking') {
            btn.innerText = 'Unlocking: 47h 59m 59s';
            btn.style.borderColor = '#FF3366';
            btn.style.color = '#FF3366';
            statusText.innerText = 'Grace Period Active';
        }

        btn.onclick = () => {
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
    };

    renderButton();
});

function scrollToIntegration() {
    document.getElementById('integration').scrollIntoView({ behavior: 'smooth' });
}
