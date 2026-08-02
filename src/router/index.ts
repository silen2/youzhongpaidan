import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard/Dashboard.vue'
import OrderList from '@/views/OrderList/OrderList.vue'
import OrderDetail from '@/views/OrderDetail/OrderDetail.vue'
import GanttView from '@/views/GanttView/GanttView.vue'
import CustomerList from '@/views/Customer/CustomerList.vue'
import CustomerDetail from '@/views/Customer/CustomerDetail.vue'
import FollowUpList from '@/views/FollowUp/FollowUpList.vue'
import PaymentList from '@/views/Payment/PaymentList.vue'
import Statistics from '@/views/Statistics/Statistics.vue'
import Settings from '@/views/Settings/Settings.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { title: '工作台' } },
    { path: '/orders', name: 'OrderList', component: OrderList, meta: { title: '订单列表' } },
    { path: '/orders/:id', name: 'OrderDetail', component: OrderDetail, meta: { title: '订单详情' } },
    { path: '/gantt', name: 'GanttView', component: GanttView, meta: { title: '排期' } },
    { path: '/customers', name: 'CustomerList', component: CustomerList, meta: { title: '客户列表' } },
    { path: '/customers/:id', name: 'CustomerDetail', component: CustomerDetail, meta: { title: '客户详情' } },
    { path: '/followups', name: 'FollowUpList', component: FollowUpList, meta: { title: '跟进列表' } },
    { path: '/payments', name: 'PaymentList', component: PaymentList, meta: { title: '账单' } },
    { path: '/statistics', name: 'Statistics', component: Statistics, meta: { title: '统计分析' } },
    { path: '/settings', name: 'Settings', component: Settings, meta: { title: '系统设置' } },
  ],
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} - 有种排单`
  }
})

export default router
