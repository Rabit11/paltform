package com.zgsf.srpm.boot;

import com.zgsf.srpm.domain.PersonDirectory;
import com.zgsf.srpm.domain.SysUser;
import com.zgsf.srpm.domain.UnitEntity;
import com.zgsf.srpm.org.OrgPeopleClient;
import com.zgsf.srpm.repo.PersonDirectoryRepository;
import com.zgsf.srpm.repo.SysUserRepository;
import com.zgsf.srpm.repo.UnitRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {
    private final UnitRepository units;
    private final SysUserRepository users;
    private final PersonDirectoryRepository people;
    private final PasswordEncoder encoder;
    private final OrgPeopleClient orgPeople;

    public DataInitializer(UnitRepository units, SysUserRepository users, PersonDirectoryRepository people,
                           PasswordEncoder encoder, OrgPeopleClient orgPeople) {
        this.units = units;
        this.users = users;
        this.people = people;
        this.encoder = encoder;
        this.orgPeople = orgPeople;
    }

    @Override
    public void run(String... args) {
        seedUnit(1, "上海飞机设计研究院", "上飞院", "unit");
        seedUnit(2, "上海飞机制造有限公司", "上飞公司", "unit");
        seedUnit(3, "北京民用飞机技术研究中心", "北研中心", "unit");
        seedUnit(4, "上海飞机客户服务有限公司", "客服公司", "unit");
        seedUnit(5, "民用飞机试飞中心", "试飞中心", "unit");
        seedUnit(6, "复合材料与基础能力中心", "基础能力中心", "unit");
        seedUnit(7, "公司总部科技管理部", "总部科技部", "hq");

        seedUser("100001", "系统管理员", "admin", "hq", 7L, "系统管理员", 1, "hq");
        seedUser("100002", "周明远", "leader", "hq", 7L, "公司领导 / 科技管理数智大屏决策查看", 0, null);
        seedUser("100003", "王建国", "mgmt", "hq", 7L, "管理团队 / 总部责任处室处长", 1, "hq");
        seedUser("100004", "何雨桐", "mgmt", "hq", 7L, "管理团队 / 总部科研项目主管", 1, "hq");
        seedUser("100005", "方致远", "mgmt", "unit", 1L, "管理团队 / 单位科研管理部门负责人", 0, null);
        seedUser("100006", "田念慈", "mgmt", "unit", 1L, "管理团队 / 单位项目主管", 0, null);
        seedUser("100007", "陈铁军", "chief", "chief", 7L, "责任总师 / 一级总师（公司级）", 0, null);
        seedUser("100008", "蔡文渊", "chief", "chief", 1L, "责任总师 / 二级总师（单位级）", 0, null);
        seedUser("100009", "赵美玲", "finance", "unit", 2L, "财务团队 / 上飞公司财务主管", 0, null);
        seedUser("100010", "毕仲文", "finance", "unit", 1L, "财务团队 / 二级单位财务负责人", 0, null);
        seedUser("100011", "龚雪君", "finance", "unit", 1L, "财务团队 / 经费核销经办", 0, null);
        seedUser("100012", "林晚晴", "team", "self", 1L, "项目团队 / 项目责任人", 0, null);

        orgPeople.fetchAll();
        if (people.count() == 0) {
            for (SysUser u : users.findAll()) {
                PersonDirectory p = new PersonDirectory();
                p.setEmpNo(u.getEmpNo());
                p.setName(u.getName());
                p.setOnJob(true);
                people.save(p);
            }
        }
    }

    private void seedUnit(long id, String name, String shortName, String kind) {
        if (units.existsById(id)) return;
        UnitEntity u = new UnitEntity();
        u.setId(id);
        u.setName(name);
        u.setShortName(shortName);
        u.setKind(kind);
        units.save(u);
    }

    private void seedUser(String emp, String name, String role, String scope, Long unitId, String title, int form, String formScope) {
        if (users.findByEmpNo(emp).isPresent()) return;
        SysUser u = new SysUser();
        u.setEmpNo(emp);
        u.setName(name);
        u.setRole(role);
        u.setScope(scope);
        u.setUnitId(unitId);
        u.setTitle(title);
        u.setStatus("在岗");
        u.setPasswordHash(encoder.encode(emp));
        u.setFormAccess(form);
        u.setFormScope(formScope);
        users.save(u);
    }
}
