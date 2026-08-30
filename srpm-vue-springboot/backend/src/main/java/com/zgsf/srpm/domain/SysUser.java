package com.zgsf.srpm.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "sys_user")
public class SysUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 32)
    private String empNo;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false, length = 32)
    private String role;
    @Column(nullable = false, length = 16)
    private String scope;
    private Long unitId;
    private String title;
    @Column(nullable = false)
    private String status;
    @Column(nullable = false)
    private String passwordHash;
    private int formAccess;
    private String formScope;
    @Column(length = 2000)
    private String formScopeKeys;
}
