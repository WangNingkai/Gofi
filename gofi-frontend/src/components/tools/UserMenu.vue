<template>
  <div class="user-wrapper">
    <div class="content-box">
      <lang-select/>
      <account-option/>
    </div>
  </div>
</template>

<script>
import NoticeIcon from '@/components/NoticeIcon'
import { mapActions, mapGetters } from 'vuex'
import LangSelect from './LangSelect'
import { message } from 'ant-design-vue'
import i18n from '../../locales'
import AccountOption from './AccountOption'

export default {
  name: 'UserMenu',
  components: {
    AccountOption,
    LangSelect,
    NoticeIcon
  },
  computed: {
    ...mapGetters(['isLogin', 'username'])
  },
  methods: {
    ...mapActions(['Logout']),
    handleLogout () {
      const that = this
      this.$confirm({
        title: that.$t('auth.logoutConfirm.title'),
        content: that.$t('auth.logoutConfirm.content'),
        onOk: () => {
          return that.Logout().then(() => {
            message.info(this.$t('auth.logoutSuccess.content'))
            this.$router.push({ name: 'index' })
          }).catch(err => {
            message.error(i18n.t(err))
          })
        },
        onCancel () {
        }
      })
    }
  }
}
</script>
<style scoped>

</style>
