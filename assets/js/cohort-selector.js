// Cohort Selector - 班级选择器
// 用于首页选择学生班级

class CohortSelector {
    constructor() {
        this.storageKey = 'bct-cohort';
        this.cohorts = [
            { id: 'taigen-a', name: 'Taigen A', label: 'A' },
            { id: 'taigen-b', name: 'Taigen B', label: 'B' }
        ];
    }

    // 初始化
    init() {
        const currentCohort = this.getCurrentCohort();
        
        if (!currentCohort) {
            // 首次使用，显示选择对话框
            this.showSelector();
        } else {
            // 已经选择过，显示班级标签
            this.showCohortBadge(currentCohort);
        }
    }

    // 获取当前班级
    getCurrentCohort() {
        return localStorage.getItem(this.storageKey);
    }

    // 设置当前班级
    setCurrentCohort(cohortId) {
        localStorage.setItem(this.storageKey, cohortId);
    }

    // 显示班级选择对话框
    showSelector() {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'cohort-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(4px);
        `;

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'cohort-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        `;

        // 标题
        const title = document.createElement('h2');
        title.textContent = '🎓 欢迎使用 BCT 学习平台！';
        title.style.cssText = `
            font-size: 1.5rem;
            color: #212529;
            margin-bottom: 10px;
        `;

        // 副标题
        const subtitle = document.createElement('p');
        subtitle.textContent = '请选择你的班级：';
        subtitle.style.cssText = `
            font-size: 1rem;
            color: #6c757d;
            margin-bottom: 30px;
        `;

        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        `;

        // 创建班级按钮
        this.cohorts.forEach(cohort => {
            const btn = document.createElement('button');
            btn.className = 'cohort-btn';
            btn.dataset.cohortId = cohort.id;
            btn.textContent = `🎓 ${cohort.name}`;
            btn.style.cssText = `
                flex: 1;
                padding: 20px;
                border: 2px solid #e0e0e0;
                background: white;
                border-radius: 12px;
                font-size: 1.1rem;
                font-weight: 600;
                color: #212529;
                cursor: pointer;
                transition: all 0.3s;
            `;

            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = '#FF8C42';
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(255, 140, 66, 0.2)';
            });

            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('selected')) {
                    btn.style.borderColor = '#e0e0e0';
                    btn.style.transform = 'translateY(0)';
                    btn.style.boxShadow = 'none';
                }
            });

            btn.addEventListener('click', () => {
                // 移除其他按钮的选中状态
                buttonContainer.querySelectorAll('.cohort-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.style.borderColor = '#e0e0e0';
                    b.style.background = 'white';
                    b.style.color = '#212529';
                });

                // 选中当前按钮
                btn.classList.add('selected');
                btn.style.borderColor = '#FF8C42';
                btn.style.background = '#FF8C42';
                btn.style.color = 'white';
            });

            buttonContainer.appendChild(btn);
        });

        // 确认按钮
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确认';
        confirmBtn.style.cssText = `
            width: 100%;
            padding: 15px;
            background: #FF8C42;
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        `;

        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.background = '#E67A30';
            confirmBtn.style.transform = 'translateY(-2px)';
        });

        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.background = '#FF8C42';
            confirmBtn.style.transform = 'translateY(0)';
        });

        confirmBtn.addEventListener('click', () => {
            const selectedBtn = buttonContainer.querySelector('.cohort-btn.selected');
            if (!selectedBtn) {
                alert('请先选择一个班级');
                return;
            }

            const cohortId = selectedBtn.dataset.cohortId;
            this.setCurrentCohort(cohortId);
            
            // 关闭对话框
            document.body.removeChild(overlay);
            
            // 显示班级标签
            this.showCohortBadge(cohortId);

            // 更新所有课程链接
            this.updateLessonLinks(cohortId);
        });

        // 组装对话框
        dialog.appendChild(title);
        dialog.appendChild(subtitle);
        dialog.appendChild(buttonContainer);
        dialog.appendChild(confirmBtn);
        overlay.appendChild(dialog);

        // 添加到页面
        document.body.appendChild(overlay);
    }

    // 显示班级标签（右上角）
    showCohortBadge(cohortId) {
        const cohort = this.cohorts.find(c => c.id === cohortId);
        if (!cohort) return;

        // 检查是否在课程页面（lesson-template-b.html）
        const isLessonPage = window.location.pathname.includes('lesson-template-b.html');
        
        if (isLessonPage) {
            // 课程页面：更新现有的标签（链接到首页）
            const badgeContainer = document.getElementById('cohort-badge-container');
            if (badgeContainer) {
                badgeContainer.textContent = `👤 ${cohort.name}`;
                badgeContainer.title = '返回首页更换班级';
            }
        } else {
            // 首页：创建固定位置的标签（可点击切换）
            let badge = document.getElementById('cohort-badge');
            
            if (!badge) {
                // 创建标签
                badge = document.createElement('div');
                badge.id = 'cohort-badge';
                badge.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #FF8C42;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 999px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(255, 140, 66, 0.3);
                    transition: all 0.3s;
                `;

                badge.addEventListener('mouseenter', () => {
                    badge.style.transform = 'translateY(-2px)';
                    badge.style.boxShadow = '0 6px 16px rgba(255, 140, 66, 0.4)';
                });

                badge.addEventListener('mouseleave', () => {
                    badge.style.transform = 'translateY(0)';
                    badge.style.boxShadow = '0 4px 12px rgba(255, 140, 66, 0.3)';
                });

                badge.addEventListener('click', () => {
                    if (confirm('要更换班级吗？')) {
                        this.showSelector();
                    }
                });

                document.body.appendChild(badge);
            }

            badge.textContent = `👤 ${cohort.name}`;
        }
    }

    // 更新所有课程链接，添加 cohort 参数
    updateLessonLinks(cohortId) {
        // 更新旧的 .lesson-link 类
        document.querySelectorAll('.lesson-link').forEach(link => {
            const url = new URL(link.href);
            url.searchParams.set('cohort', cohortId);
            link.href = url.toString();
        });
        
        // 更新新的 .course-entry-btn 类（首页 BCT 按钮）
        document.querySelectorAll('.course-entry-btn').forEach(btn => {
            const url = new URL(btn.href, window.location.origin);
            url.searchParams.set('cohort', cohortId);
            btn.href = url.toString();
        });
        
        console.log(`✅ 已更新所有课程链接为班级：${cohortId}`);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const selector = new CohortSelector();
    selector.init();
    
    // 如果已经选择过班级，更新链接
    const currentCohort = selector.getCurrentCohort();
    if (currentCohort) {
        selector.updateLessonLinks(currentCohort);
    }
});
